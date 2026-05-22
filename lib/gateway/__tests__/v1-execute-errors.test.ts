/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthenticationError, RateLimitError } from '@/lib/providers/errors';

const mockExecuteGatewayChat = vi.fn();
const mockStreamGatewayChat = vi.fn();
const mockResolveGatewayProvider = vi.fn();

vi.mock('@/lib/gateway/chat-executor', () => ({
    executeGatewayChat: (...args: unknown[]) => mockExecuteGatewayChat(...args),
    streamGatewayChat: (...args: unknown[]) => mockStreamGatewayChat(...args),
}));

vi.mock('@/lib/gateway/providers-setup', () => ({
    resolveGatewayProvider: (...args: unknown[]) => mockResolveGatewayProvider(...args),
}));

vi.mock('@/lib/gateway/output-guard', () => ({
    runGatewayOutputGuard: vi.fn().mockResolvedValue({ ok: true }),
}));

import { runV1ProviderExecution } from '@/lib/gateway/v1-execute';
import { createMockGatewayContext, toUnifiedMessages } from '@/lib/gateway/__tests__/fixtures';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';

const inputSecurity: SecurityCheckResult = {
    safe: true,
    reasons: [],
    layer: 'input',
    riskScore: 0,
    confidence: 1,
};

function baseParams() {
    const messages = toUnifiedMessages([{ role: 'user', content: 'Hello' }]);
    const gatewayCtx = createMockGatewayContext();
    return {
        supabase: {} as never,
        gatewayCtx,
        model: 'gpt-4o',
        messages,
        inputText: 'Hello',
        inputSecurity,
        stream: false,
        endUserId: null,
        endUserQuota: null,
        recordEndUserUsage: vi.fn(),
        logSuccess: vi.fn(),
        incrementUsage: vi.fn(),
    };
}

describe('runV1ProviderExecution provider errors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveGatewayProvider.mockResolvedValue({
            providerName: 'openai',
            model: 'gpt-4o',
            provider: { countTokens: vi.fn(), getPricing: vi.fn() },
            router: {},
        });
    });

    it('maps AuthenticationError to 401 with provider_auth_error code', async () => {
        mockExecuteGatewayChat.mockRejectedValue(new AuthenticationError('openai'));

        const result = await runV1ProviderExecution(baseParams());

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
            expect((result.body.error as Record<string, unknown>)?.code).toBe('provider_auth_error');
        }
    });

    it('maps RateLimitError to 429 with retry_after', async () => {
        mockExecuteGatewayChat.mockRejectedValue(new RateLimitError('openai', 30));

        const result = await runV1ProviderExecution(baseParams());

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(429);
            expect((result.body.error as Record<string, unknown>)?.code).toBe('provider_rate_limited');
            expect(result.body.retry_after).toBe(30);
        }
    });
});
