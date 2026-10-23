/**
 * @vitest-environment node
 *
 * Chat-route knowledge base (RAG) integration: `knowledge_bases` is
 * validated against the project, retrieval injects a cited system block,
 * citations come back on the response, and the cache is skipped.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
    CHAT_REQUEST_BODY,
    createMockGatewayContext,
    createMockInputPipelineSuccess,
} from '@/lib/gateway/__tests__/fixtures';

const routeMocks = vi.hoisted(() => ({
    validateGatewayRequest: vi.fn(),
    runGatewayInputPipeline: vi.fn(),
    runV1ProviderExecution: vi.fn(),
    checkEndUserQuota: vi.fn(),
    logGatewayRequest: vi.fn(),
    incrementUsage: vi.fn(),
    addGatewayHeaders: vi.fn((res: Response) => res),
    logApiGatewayRequest: vi.fn(),
    getCachedCacheConfig: vi.fn(),
    lookupCache: vi.fn(),
    getProjectCacheConfig: vi.fn(),
    loadAgentKeyContext: vi.fn(),
    // memory
    getProjectMemorySettings: vi.fn(),
    retrieveMemories: vi.fn(),
    runChatMemoryWriteback: vi.fn(),
    waitUntil: vi.fn(),
    // knowledge
    retrieveKnowledge: vi.fn(),
    knowledgeBaseRows: [] as Array<{ id: string; tenant_id: string | null }>,
}));

vi.mock('@vercel/functions', () => ({
    waitUntil: (...args: unknown[]) => routeMocks.waitUntil(...args),
}));

vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: (...args: unknown[]) => routeMocks.validateGatewayRequest(...args),
    handleCorsPreFlight: vi.fn(),
    addGatewayHeaders: (...args: unknown[]) => (routeMocks.addGatewayHeaders as never as (...a: unknown[]) => unknown)(...args),
    logGatewayRequest: (...args: unknown[]) => routeMocks.logGatewayRequest(...args),
    incrementUsage: (...args: unknown[]) => routeMocks.incrementUsage(...args),
}));

vi.mock('@/lib/gateway/input-guard', () => ({
    runGatewayInputPipeline: (...args: unknown[]) => routeMocks.runGatewayInputPipeline(...args),
}));

vi.mock('@/lib/gateway/v1-execute', () => ({
    runV1ProviderExecution: (...args: unknown[]) => routeMocks.runV1ProviderExecution(...args),
}));

vi.mock('@/lib/end-user-billing', () => ({
    checkEndUserQuota: (...args: unknown[]) => routeMocks.checkEndUserQuota(...args),
    recordEndUserUsage: vi.fn(),
}));

vi.mock('@/lib/api-gateway-logs', () => ({
    extractGatewayCallerIdentity: vi.fn(() => ({})),
    logApiGatewayRequest: (...args: unknown[]) => routeMocks.logApiGatewayRequest(...args),
}));

vi.mock('@/lib/cache/prompt-cache', () => ({
    computeExactCacheKey: vi.fn(() => 'cache-key'),
    getProjectCacheConfig: (...args: unknown[]) => routeMocks.getProjectCacheConfig(...args),
    lookupCache: (...args: unknown[]) => routeMocks.lookupCache(...args),
    storeInCache: vi.fn(),
    recordCacheHit: vi.fn(),
    logCacheEvent: vi.fn(),
}));

vi.mock('@/lib/config-cache', () => ({
    getCachedCacheConfig: (...args: unknown[]) => routeMocks.getCachedCacheConfig(...args),
    setCachedCacheConfig: vi.fn(),
    getCachedMemoryConfig: vi.fn(async () => null),
    setCachedMemoryConfig: vi.fn(),
}));

vi.mock('@/lib/gateway/agent-context', () => ({
    resolveAgentContext: vi.fn(async () => ({ errorCode: 'agent_not_found' })),
    loadAgentKeyContext: vi.fn(async () => ({ agentConfigModel: null })),
}));

vi.mock('@/lib/prompts/registry', () => ({
    resolvePrompt: vi.fn(),
    logPromptUsage: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
    createAdminClient: vi.fn(() => ({
        from: (table: string) => {
            const query = {
                select: () => query,
                eq: () => query,
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
                in: (_col: string, ids: string[]) => Promise.resolve({
                    data: table === 'knowledge_bases'
                        ? routeMocks.knowledgeBaseRows.filter((kb) => ids.includes(kb.id))
                        : [],
                    error: null,
                }),
            };
            return query;
        },
    })),
}));

vi.mock('@/lib/embedded/turn-knowledge', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/embedded/turn-knowledge')>();
    return {
        ...original,
        retrieveKnowledge: (...args: unknown[]) => routeMocks.retrieveKnowledge(...args),
    };
});

vi.mock('@/lib/memory/settings', () => ({
    getProjectMemorySettings: (...args: unknown[]) => routeMocks.getProjectMemorySettings(...args),
}));

vi.mock('@/lib/memory/retrieval', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/memory/retrieval')>();
    return {
        ...original,
        retrieveMemories: (...args: unknown[]) => routeMocks.retrieveMemories(...args),
    };
});

vi.mock('@/lib/memory/writeback', () => ({
    runChatMemoryWriteback: (...args: unknown[]) => routeMocks.runChatMemoryWriteback(...args),
    writeMemories: vi.fn(),
}));

import { POST } from '@/app/api/v1/chat/completions/route';
import { POST as nativePost } from '@/app/api/ai/chat/route';

const OPENAI_RESPONSE = {
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: 1,
    model: 'gpt-4o',
    choices: [{ index: 0, message: { role: 'assistant', content: 'Refunds take 5 days [1].' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const KB_ID = '11111111-1111-1111-1111-111111111111';

function chatRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://x/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', CENCORI_API_KEY: 'csk_test' },
    });
}

describe('chat completions knowledge bases', () => {
    let ctx: ReturnType<typeof createMockGatewayContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        ctx = createMockGatewayContext();
        routeMocks.validateGatewayRequest.mockResolvedValue({ success: true, context: ctx });
        routeMocks.runGatewayInputPipeline.mockImplementation(
            async (args: { messages: unknown[] }) => createMockInputPipelineSuccess(args.messages as never)
        );
        routeMocks.getCachedCacheConfig.mockResolvedValue(null);
        routeMocks.getProjectCacheConfig.mockResolvedValue({ cacheEnabled: true, excludedModels: [], maxCacheableTemperature: 1 });
        routeMocks.lookupCache.mockResolvedValue({ hit: false });
        routeMocks.knowledgeBaseRows = [{ id: KB_ID, tenant_id: null }];
        routeMocks.retrieveKnowledge.mockResolvedValue({
            block: 'Company knowledge relevant to this request.\n\n[1] Refunds are processed within 5 business days.',
            citations: [{ chunk_id: 'chunk-1', source_id: 'source-1', ord: 0, page: 2, score: 0.91 }],
        });
        routeMocks.runV1ProviderExecution.mockImplementation(async () => ({
            ok: true,
            response: NextResponse.json(OPENAI_RESPONSE),
        }));
    });

    it('no knowledge_bases field ⇒ retrieval never runs, no knowledge in response', async () => {
        const res = await POST(chatRequest({ ...CHAT_REQUEST_BODY }));
        expect(res.status).toBe(200);
        expect((await res.json()).knowledge).toBeUndefined();
        expect(routeMocks.retrieveKnowledge).not.toHaveBeenCalled();
        // Baseline for the cache test below: an ungrounded request is cached.
        expect(routeMocks.lookupCache).toHaveBeenCalled();
    });

    it('injects the cited block and returns citations', async () => {
        const res = await POST(chatRequest({ ...CHAT_REQUEST_BODY, knowledge_bases: [`kb_${KB_ID}`] }));
        expect(res.status).toBe(200);

        expect(routeMocks.retrieveKnowledge).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ knowledgeBaseIds: [KB_ID], projectId: ctx.projectId }),
        );
        const execArgs = routeMocks.runV1ProviderExecution.mock.calls[0][0] as {
            messages: Array<{ role: string; content: string }>;
        };
        const injected = execArgs.messages.find((m) => m.role === 'system' && m.content.includes('Refunds are processed'));
        expect(injected).toBeDefined();
        // Injected ahead of the user's turn.
        expect(execArgs.messages.indexOf(injected!)).toBeLessThan(execArgs.messages.findIndex((m) => m.role === 'user'));

        const body = await res.json();
        expect(body.knowledge).toEqual({
            knowledge_bases: [`kb_${KB_ID}`],
            citations: [{ n: 1, chunk_id: 'chunk-1', source_id: 'src_source-1', ord: 0, page: 2, score: 0.91 }],
        });
    });

    it('skips the prompt cache for knowledge-grounded requests', async () => {
        await POST(chatRequest({ ...CHAT_REQUEST_BODY, knowledge_bases: [KB_ID] }));
        expect(routeMocks.lookupCache).not.toHaveBeenCalled();
    });

    it('rejects a malformed field', async () => {
        for (const knowledge_bases of ['kb_1', [], [42], ['a', 'b', 'c', 'd']]) {
            const res = await POST(chatRequest({ ...CHAT_REQUEST_BODY, knowledge_bases }));
            expect(res.status).toBe(400);
        }
        expect(routeMocks.retrieveKnowledge).not.toHaveBeenCalled();
    });

    it('404s a knowledge base outside the project', async () => {
        routeMocks.knowledgeBaseRows = [];
        const res = await POST(chatRequest({ ...CHAT_REQUEST_BODY, knowledge_bases: [KB_ID] }));
        expect(res.status).toBe(404);
    });

    it('refuses tenant-scoped bases and publishable keys', async () => {
        routeMocks.knowledgeBaseRows = [{ id: KB_ID, tenant_id: 'tenant-1' }];
        expect((await POST(chatRequest({ ...CHAT_REQUEST_BODY, knowledge_bases: [KB_ID] }))).status).toBe(403);

        routeMocks.knowledgeBaseRows = [{ id: KB_ID, tenant_id: null }];
        routeMocks.validateGatewayRequest.mockResolvedValue({ success: true, context: { ...ctx, keyType: 'publishable' } });
        expect((await POST(chatRequest({ ...CHAT_REQUEST_BODY, knowledge_bases: [KB_ID] }))).status).toBe(403);
        expect(routeMocks.retrieveKnowledge).not.toHaveBeenCalled();
    });
});

describe('native /api/ai/chat knowledge bases', () => {
    function nativeRequest(body: Record<string, unknown>): NextRequest {
        return new NextRequest('http://x/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json', CENCORI_API_KEY: 'csk_test' },
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        routeMocks.validateGatewayRequest.mockResolvedValue({ success: true, context: createMockGatewayContext() });
        routeMocks.runGatewayInputPipeline.mockImplementation(
            async (args: { messages: unknown[] }) => createMockInputPipelineSuccess(args.messages as never)
        );
        routeMocks.getCachedCacheConfig.mockResolvedValue(null);
        routeMocks.getProjectCacheConfig.mockResolvedValue({ cacheEnabled: false, excludedModels: [] });
        routeMocks.knowledgeBaseRows = [{ id: KB_ID, tenant_id: null }];
        routeMocks.retrieveKnowledge.mockResolvedValue({
            block: 'Company knowledge relevant to this request.\n\n[1] Refunds are processed within 5 business days.',
            citations: [{ chunk_id: 'chunk-1', source_id: 'source-1', ord: 0, page: 2, score: 0.91 }],
        });
        routeMocks.runV1ProviderExecution.mockImplementation(async () => ({
            ok: true,
            response: NextResponse.json({ content: 'Refunds take 5 days [1].', model: 'gpt-6-sol' }),
        }));
    });

    it('accepts camelCase knowledgeBases, injects the block and returns citations', async () => {
        const res = await nativePost(nativeRequest({ ...CHAT_REQUEST_BODY, knowledgeBases: [`kb_${KB_ID}`] }));
        expect(res.status).toBe(200);

        const execArgs = routeMocks.runV1ProviderExecution.mock.calls[0][0] as {
            messages: Array<{ role: string; content: string }>;
        };
        expect(execArgs.messages.some((m) => m.role === 'system' && m.content.includes('Refunds are processed'))).toBe(true);
        expect((await res.json()).knowledge).toEqual({
            knowledge_bases: [`kb_${KB_ID}`],
            citations: [{ n: 1, chunk_id: 'chunk-1', source_id: 'src_source-1', ord: 0, page: 2, score: 0.91 }],
        });
    });

    it('returns flat errors for bad or foreign bases', async () => {
        const bad = await nativePost(nativeRequest({ ...CHAT_REQUEST_BODY, knowledge_bases: [] }));
        expect(bad.status).toBe(400);
        expect(await bad.json()).toMatchObject({ error: 'invalid_knowledge_bases' });

        routeMocks.knowledgeBaseRows = [];
        const missing = await nativePost(nativeRequest({ ...CHAT_REQUEST_BODY, knowledgeBases: [KB_ID] }));
        expect(missing.status).toBe(404);
        expect(routeMocks.retrieveKnowledge).not.toHaveBeenCalled();
    });
});
