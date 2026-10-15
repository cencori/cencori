/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
    validateGatewayRequest: vi.fn(),
    logGatewayRequest: vi.fn(),
    incrementUsage: vi.fn(),
    assertAccess: vi.fn(),
    evaluate: vi.fn(),
    price: vi.fn(),
    resolveKey: vi.fn(),
}));

vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: mocks.validateGatewayRequest,
    addGatewayHeaders: (r: unknown) => r,
    handleCorsPreFlight: vi.fn(() => new NextResponse(null, { status: 204 })),
    logGatewayRequest: mocks.logGatewayRequest,
    incrementUsage: mocks.incrementUsage,
}));

vi.mock('@/lib/gateway/model-access', () => ({
    assertApiKeyModelAccess: mocks.assertAccess,
}));

vi.mock('@/lib/judgment/registry', () => ({
    getJudgmentAdapter: vi.fn((provider: string) =>
        provider === 'typesafe'
            ? {
                provider: 'typesafe',
                managedEnvVar: 'TYPESAFE_API_KEY',
                evaluate: mocks.evaluate,
                price: mocks.price,
                resolveKey: mocks.resolveKey,
            }
            : null,
    ),
    resolveJudgmentAdapter: vi.fn((model: string) => {
        if (model === 'gpt-5') {
            throw Object.assign(new Error(`Unknown judgment model '${model}'.`), { code: 'unknown_model', status: 404 });
        }
        return {
            provider: 'typesafe',
            managedEnvVar: 'TYPESAFE_API_KEY',
            evaluate: mocks.evaluate,
            price: mocks.price,
            resolveKey: mocks.resolveKey,
        };
    }),
}));

vi.mock('@/lib/providers/display-pricing', () => ({
    getModelDisplayPrice: vi.fn(() => ({
        input: '$0.04', output: '$0.00', inputPerMillion: 0.042, outputPerMillion: 0,
        perImage: false, perImageUsd: null,
    })),
}));

import { GET, POST } from '@/app/api/v1/judgments/route';
import { ModelAccessDeniedError } from '@/lib/providers/errors';

const ctx = {
    supabase: {},
    projectId: 'proj-1',
    organizationId: 'org-1',
    apiKeyId: 'key-1',
    allowedModels: null,
    sponsoredModels: null,
    requestId: 'req-1',
} as never;

const req = (body: unknown) => ({ json: async () => body }) as never;
const validBody = {
    state: 'Charged twice, refund please',
    model: 'jev-latest',
    questions: { refund: { type: 'noul', instructions: 'Requests a refund?' } },
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateGatewayRequest.mockResolvedValue({ success: true, context: ctx });
    mocks.assertAccess.mockReturnValue({ allowed: true });
});

describe('POST /v1/judgments', () => {
    it('returns answers and bills input tokens on the managed key', async () => {
        mocks.resolveKey.mockResolvedValue({ key: 'managed', usesByok: false });
        mocks.price.mockResolvedValue(0.0000042);
        mocks.evaluate.mockResolvedValue({
            model: 'jev-1.13.0',
            answers: { refund: { type: 'noul', noul: 0.95 } },
            usage: { input_tokens: 100, output_tokens: 5 },
        });

        const res = await POST(req(validBody));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.object).toBe('judgment');
        expect(body.model).toBe('jev-1.13.0');
        expect(body.answers).toEqual({ refund: { type: 'noul', noul: 0.95 } });
        expect(body.usage).toEqual({ input_tokens: 100, output_tokens: 5 });
        expect(body.uses_byok).toBeUndefined();
        // Input-token cost charged; BYOK would be zero.
        expect(mocks.incrementUsage).toHaveBeenCalledWith(ctx, 0.0000042);
        expect(mocks.logGatewayRequest).toHaveBeenCalledWith(ctx, expect.objectContaining({
            endpoint: 'v1/judgments',
            provider: 'typesafe',
            status: 'success',
        }));
    });

    it('charges nothing on a BYOK key', async () => {
        mocks.resolveKey.mockResolvedValue({ key: 'byok', usesByok: true });
        mocks.price.mockResolvedValue(0.0000042);
        mocks.evaluate.mockResolvedValue({
            model: 'jev-1.13.0',
            answers: {},
            usage: { input_tokens: 100, output_tokens: 5 },
        });

        const res = await POST(req(validBody));
        const body = await res.json();
        expect(body.uses_byok).toBe(true);
        expect(mocks.incrementUsage).toHaveBeenCalledWith(ctx, 0);
    });

    it('400s on invalid questions without touching upstream', async () => {
        const res = await POST(req({ state: 'x', questions: {} }));
        expect(res.status).toBe(400);
        expect(mocks.evaluate).not.toHaveBeenCalled();
    });

    it('402s when no TypeSafe key is configured', async () => {
        mocks.resolveKey.mockResolvedValue(null);
        const res = await POST(req(validBody));
        expect(res.status).toBe(402);
        const body = await res.json();
        expect(body.error).toBe('provider_connection_required');
        expect(mocks.evaluate).not.toHaveBeenCalled();
    });

    it('403s for keys not granted the model', async () => {
        mocks.assertAccess.mockImplementation(() => {
            throw new ModelAccessDeniedError('typesafe', 'jev-latest');
        });
        const res = await POST(req(validBody));
        expect(res.status).toBe(403);
        expect(mocks.evaluate).not.toHaveBeenCalled();
    });

    it('502s on upstream failure', async () => {
        mocks.resolveKey.mockResolvedValue({ key: 'managed', usesByok: false });
        mocks.price.mockResolvedValue(0);
        const { JudgmentUpstreamError } = await import('@/lib/judgment/typesafe');
        mocks.evaluate.mockRejectedValue(new JudgmentUpstreamError('TypeSafe request failed (500)'));
        const res = await POST(req(validBody));
        expect(res.status).toBe(502);
    });
});

describe('GET /v1/judgments', () => {
    it('lists the judgment models', async () => {
        const res = await GET();
        const body = await res.json();
        expect(body.data.map((m: { id: string }) => m.id)).toEqual(['jev-latest', 'jev-preview', 'jev-1.13.0']);
        for (const row of body.data) {
            expect(row.owned_by).toBe('typesafe');
            expect(row.type).toBe('judgment');
            expect(row.available).toBe(true);
        }
    });
});
