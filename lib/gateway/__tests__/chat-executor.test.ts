/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { UnifiedChatRequest, UnifiedChatResponse } from '@/lib/providers/base';

const mockIsCircuitOpen = vi.fn();
const mockRecordSuccess = vi.fn();
const mockRecordFailure = vi.fn();
const mockGetFallbackChain = vi.fn();
const mockGetFallbackModel = vi.fn();
const mockIsNonRetryableError = vi.fn();
const mockTriggerFallbackWebhook = vi.fn();
const mockInitializeBYOKProviders = vi.fn();

vi.mock('@/lib/providers/circuit-breaker', () => ({
    isCircuitOpen: (...args: unknown[]) => mockIsCircuitOpen(...args),
    recordSuccess: (...args: unknown[]) => mockRecordSuccess(...args),
    recordFailure: (...args: unknown[]) => mockRecordFailure(...args),
}));

vi.mock('@/lib/providers/failover', () => ({
    getFallbackChain: (...args: unknown[]) => mockGetFallbackChain(...args),
    getFallbackModel: (...args: unknown[]) => mockGetFallbackModel(...args),
    isNonRetryableError: (...args: unknown[]) => mockIsNonRetryableError(...args),
}));

vi.mock('@/lib/webhooks', () => ({
    triggerSecurityWebhook: vi.fn(),
    triggerFallbackWebhook: (...args: unknown[]) => mockTriggerFallbackWebhook(...args),
}));

vi.mock('@/lib/gateway/providers-setup', () => ({
    initializeBYOKProviders: (...args: unknown[]) => mockInitializeBYOKProviders(...args),
}));

import { executeGatewayChat, streamGatewayChat } from '@/lib/gateway/chat-executor';

function createMockSupabaseForExecutor(options?: {
    enableFallback?: boolean;
    maxRetries?: number;
}) {
    return {
        from: vi.fn((table: string) => {
            if (table === 'project_settings') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: async () => ({
                                data: {
                                    enable_fallback: options?.enableFallback ?? true,
                                    fallback_provider: null,
                                    max_retries_before_fallback: options?.maxRetries ?? 1,
                                },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            return {
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null, error: null }),
                    }),
                }),
            };
        }),
    };
}

function mockResponse(content: string): UnifiedChatResponse {
    return {
        content,
        model: 'gpt-4o',
        provider: 'openai',
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        cost: { providerCostUsd: 0.001, cencoriChargeUsd: 0.001, markupPercentage: 0 },
        latencyMs: 10,
        finishReason: 'stop',
    };
}

describe('executeGatewayChat failover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsCircuitOpen.mockResolvedValue(false);
        mockRecordSuccess.mockResolvedValue(undefined);
        mockRecordFailure.mockResolvedValue(undefined);
        mockIsNonRetryableError.mockReturnValue(false);
        mockGetFallbackChain.mockReturnValue(['anthropic']);
        mockGetFallbackModel.mockResolvedValue('claude-sonnet-4');
        mockInitializeBYOKProviders.mockResolvedValue({ success: true });
    });

    it('returns primary provider response on success', async () => {
        const primaryChat = vi.fn().mockResolvedValue(mockResponse('primary ok'));

        const result = await executeGatewayChat({
            supabase: createMockSupabaseForExecutor() as never,
            projectId: 'proj-ex',
            organizationId: 'org-ex',
            tier: 'pro',
            request: { messages: [], model: 'gpt-4o', stream: false } as UnifiedChatRequest,
            resolved: {
                providerName: 'openai',
                model: 'gpt-4o',
                provider: { chat: primaryChat, stream: vi.fn(), countTokens: vi.fn(), getPricing: vi.fn() },
                router: { hasProvider: () => true, getProvider: vi.fn() },
            } as never,
        });

        expect(result.content).toBe('primary ok');
        expect(result.usedFallback).toBe(false);
        expect(primaryChat).toHaveBeenCalledTimes(1);
    });

    it('falls back to secondary provider when primary fails', async () => {
        const primaryChat = vi.fn().mockRejectedValue(new Error('openai down'));
        const fallbackChat = vi.fn().mockResolvedValue(mockResponse('fallback ok'));
        const router = {
            hasProvider: (name: string) => name === 'anthropic',
            getProvider: (name: string) =>
                name === 'anthropic'
                    ? { chat: fallbackChat, stream: vi.fn(), countTokens: vi.fn(), getPricing: vi.fn() }
                    : { chat: vi.fn(), stream: vi.fn(), countTokens: vi.fn(), getPricing: vi.fn() },
        };

        const result = await executeGatewayChat({
            supabase: createMockSupabaseForExecutor({ maxRetries: 1 }) as never,
            projectId: 'proj-ex',
            organizationId: 'org-ex',
            tier: 'pro',
            request: { messages: [], model: 'gpt-4o', stream: false } as UnifiedChatRequest,
            resolved: {
                providerName: 'openai',
                model: 'gpt-4o',
                provider: { chat: primaryChat, stream: vi.fn(), countTokens: vi.fn(), getPricing: vi.fn() },
                router,
            } as never,
        });

        expect(result.content).toBe('fallback ok');
        expect(result.usedFallback).toBe(true);
        expect(result.actualProvider).toBe('anthropic');
        expect(mockTriggerFallbackWebhook).toHaveBeenCalled();
    });

    it('skips primary when circuit is open and uses fallback', async () => {
        mockIsCircuitOpen.mockImplementation(async (provider: string) => provider === 'openai');

        const primaryChat = vi.fn().mockResolvedValue(mockResponse('should not run'));
        const fallbackChat = vi.fn().mockResolvedValue(mockResponse('circuit fallback'));
        const router = {
            hasProvider: () => true,
            getProvider: (name: string) =>
                name === 'anthropic'
                    ? { chat: fallbackChat, stream: vi.fn(), countTokens: vi.fn(), getPricing: vi.fn() }
                    : { chat: primaryChat, stream: vi.fn(), countTokens: vi.fn(), getPricing: vi.fn() },
        };

        const result = await executeGatewayChat({
            supabase: createMockSupabaseForExecutor({ maxRetries: 1 }) as never,
            projectId: 'proj-ex',
            organizationId: 'org-ex',
            tier: 'pro',
            request: { messages: [], model: 'gpt-4o', stream: false } as UnifiedChatRequest,
            resolved: {
                providerName: 'openai',
                model: 'gpt-4o',
                provider: { chat: primaryChat, stream: vi.fn(), countTokens: vi.fn(), getPricing: vi.fn() },
                router,
            } as never,
        });

        expect(result.content).toBe('circuit fallback');
        expect(primaryChat).not.toHaveBeenCalled();
    });
});

describe('streamGatewayChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsCircuitOpen.mockResolvedValue(false);
        mockRecordSuccess.mockResolvedValue(undefined);
        mockRecordFailure.mockResolvedValue(undefined);
        mockIsNonRetryableError.mockReturnValue(false);
        mockGetFallbackChain.mockReturnValue([]);
    });

    it('yields chunks with execution metadata', async () => {
        async function* mockStream() {
            yield { delta: 'Hello', finishReason: null };
            yield { delta: ' world', finishReason: 'stop' };
        }

        const stream = streamGatewayChat({
            supabase: createMockSupabaseForExecutor({ enableFallback: false }) as never,
            projectId: 'proj-ex',
            organizationId: 'org-ex',
            tier: 'free',
            request: { messages: [], model: 'gpt-4o', stream: true } as UnifiedChatRequest,
            resolved: {
                providerName: 'openai',
                model: 'gpt-4o',
                provider: {
                    chat: vi.fn(),
                    stream: () => mockStream(),
                    countTokens: vi.fn(),
                    getPricing: vi.fn(),
                },
                router: { hasProvider: () => false, getProvider: vi.fn() },
            } as never,
        });

        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        expect(chunks.length).toBe(2);
        expect(chunks[0].delta).toBe('Hello');
        expect(chunks[0].actualProvider).toBe('openai');
        expect(chunks[1].finishReason).toBe('stop');
    });
});
