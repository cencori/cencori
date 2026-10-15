/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    safeFetch: vi.fn(),
    resolveKeyRow: vi.fn(),
    decrypt: vi.fn(),
    pricingFromDB: vi.fn(),
}));

vi.mock('@/lib/security/outbound-url', () => ({ safeProviderFetch: mocks.safeFetch }));
vi.mock('@/lib/providers/byok-store', () => ({ resolveProviderKeyRow: mocks.resolveKeyRow }));
vi.mock('@/lib/encryption', () => ({ decryptApiKey: mocks.decrypt }));
vi.mock('@/lib/providers/pricing', () => ({ getPricingFromDB: mocks.pricingFromDB }));

import {
    evaluateJudgment,
    priceJudgment,
    resolveJudgmentKey,
    validateJudgmentBody,
    JudgmentRequestError,
} from '../typesafe';

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TYPESAFE_API_KEY;
});

describe('validateJudgmentBody', () => {
    const valid = {
        state: 'Payouts failing for 3 days',
        questions: {
            is_urgent: { type: 'noul', instructions: 'Does this convey urgency?' },
        },
    };

    it('defaults the model to jev-latest', () => {
        expect(validateJudgmentBody(valid).model).toBe('jev-latest');
    });

    it('accepts all three question types within their limits', () => {
        const body = validateJudgmentBody({
            state: { message: 'Charged twice' },
            model: 'jev-1.13.0',
            questions: {
                dept: { type: 'choice', instructions: 'Which team?', criteria: { billing: 'Payments', tech: null } },
                anger: { type: 'score', instructions: 'How angry?', criteria: ['Calm', 'Angry'] },
                urgent: { type: 'noul', instructions: 'Urgent?' },
            },
        });
        expect(body.model).toBe('jev-1.13.0');
        expect(Object.keys(body.questions)).toHaveLength(3);
    });

    it('rejects an unknown model id', () => {
        expect(() => validateJudgmentBody({ ...valid, model: 'gpt-5' }))
            .toThrowError(JudgmentRequestError);
    });

    it('rejects empty questions and unknown question types', () => {
        expect(() => validateJudgmentBody({ state: 'x', questions: {} }))
            .toThrowError(/non-empty/);
        expect(() => validateJudgmentBody({ state: 'x', questions: { q: { type: 'essay', instructions: 'Write' } } }))
            .toThrowError(/unknown type/);
    });

    it('enforces choice option and score level limits', () => {
        expect(() => validateJudgmentBody({
            state: 'x',
            questions: { q: { type: 'choice', instructions: 'Pick', criteria: {} } },
        })).toThrowError(/1–255/);
        expect(() => validateJudgmentBody({
            state: 'x',
            questions: { q: { type: 'score', instructions: 'Rate', criteria: ['Only'] } },
        })).toThrowError(/2–10/);
    });

    it('rejects an over-budget state before it is billed', () => {
        expect(() => validateJudgmentBody({
            state: 'x'.repeat(300_000),
            questions: { q: { type: 'noul', instructions: 'Yes?' } },
        })).toThrowError(/exceeds Jev/);
    });
});

describe('resolveJudgmentKey', () => {
    const supabase = {} as never;

    it('prefers the project BYOK key', async () => {
        mocks.resolveKeyRow.mockResolvedValue({ row: { encrypted_key: 'enc', is_active: true } });
        mocks.decrypt.mockReturnValue('byok-key');
        await expect(resolveJudgmentKey(supabase, 'proj', 'org')).resolves.toEqual({ key: 'byok-key', usesByok: true });
        expect(mocks.resolveKeyRow).toHaveBeenCalledWith(expect.anything(), { projectId: 'proj', provider: 'typesafe' });
        expect(mocks.decrypt).toHaveBeenCalledWith('enc', 'org');
    });

    it('falls back to the managed key, then to null', async () => {
        mocks.resolveKeyRow.mockResolvedValue(null);
        await expect(resolveJudgmentKey(supabase, 'proj', 'org')).resolves.toBeNull();
        process.env.TYPESAFE_API_KEY = 'managed-key';
        await expect(resolveJudgmentKey(supabase, 'proj', 'org')).resolves.toEqual({ key: 'managed-key', usesByok: false });
    });
});

describe('evaluateJudgment', () => {
    const request = {
        state: 'Charged twice',
        questions: { refund: { type: 'noul' as const, instructions: 'Requests a refund?' } },
        model: 'jev-latest',
    };

    function upstream(payload: unknown, init?: { status?: number; headers?: Record<string, string> }) {
        return new Response(JSON.stringify(payload), {
            status: init?.status ?? 200,
            headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        });
    }

    it('returns answers and usage on success', async () => {
        mocks.safeFetch.mockResolvedValue(upstream({
            model: 'jev-1.13.0',
            answers: { refund: { type: 'noul', noul: 0.95 } },
            usage: { input_tokens: 100, output_tokens: 5 },
        }));
        const result = await evaluateJudgment('key', request);
        expect(result.model).toBe('jev-1.13.0');
        expect(result.answers).toEqual({ refund: { type: 'noul', noul: 0.95 } });
        expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 5 });
        const [, opts] = mocks.safeFetch.mock.calls[0];
        expect(opts.headers.Authorization).toBe('Bearer key');
        expect(JSON.parse(opts.body).model).toBe('jev-latest');
    });

    it('retries rate limits and surfaces auth failures', async () => {
        mocks.safeFetch
            .mockResolvedValueOnce(upstream({}, { status: 429, headers: { 'retry-after': '0' } }))
            .mockResolvedValueOnce(upstream({
                model: 'jev-1.13.0',
                answers: { refund: { type: 'noul', noul: 0.1 } },
                usage: { input_tokens: 50, output_tokens: 2 },
            }));
        const result = await evaluateJudgment('key', request);
        expect(result.usage.input_tokens).toBe(50);
        expect(mocks.safeFetch).toHaveBeenCalledTimes(2);

        mocks.safeFetch.mockResolvedValue(upstream({ error: 'bad key' }, { status: 401 }));
        await expect(evaluateJudgment('key', request)).rejects.toThrowError(/API key/);
    });
});

describe('priceJudgment', () => {
    it('bills input tokens at the DB rate', async () => {
        mocks.pricingFromDB.mockResolvedValue({ inputPer1KTokens: 0.000042, outputPer1KTokens: 0 });
        // 1M input tokens at $0.042/MTok.
        await expect(priceJudgment('jev-latest', 1_000_000)).resolves.toBeCloseTo(0.042, 6);
        expect(mocks.pricingFromDB).toHaveBeenCalledWith('typesafe', 'jev-latest');
    });
});
