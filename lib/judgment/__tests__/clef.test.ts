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
    evaluateClefJudgment,
    parseClefKey,
    priceClefJudgment,
    resolveClefKey,
} from '../clef';
import { JudgmentRequestError } from '../typesafe';

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
});

describe('parseClefKey', () => {
    it('splits the combined ACCOUNT_ID:API_TOKEN form', () => {
        expect(parseClefKey('abc123:token456')).toEqual({ accountId: 'abc123', apiToken: 'token456' });
    });

    it('fails closed on a bare token without an account id', () => {
        const error = new JudgmentRequestError('invalid_key', 'x', 402);
        expect(() => parseClefKey('just-a-token')).toThrowError(expect.objectContaining({ code: 'invalid_key', status: 402 }));
        expect(error).toBeInstanceOf(JudgmentRequestError);
    });
});

describe('resolveClefKey', () => {
    const supabase = {} as never;

    it('prefers the project BYOK key (stored as ACCOUNT_ID:API_TOKEN)', async () => {
        mocks.resolveKeyRow.mockResolvedValue({ row: { encrypted_key: 'enc', is_active: true } });
        mocks.decrypt.mockReturnValue('byok-account:byok-token');
        await expect(resolveClefKey(supabase, 'proj', 'org')).resolves.toEqual({ key: 'byok-account:byok-token', usesByok: true });
        expect(mocks.resolveKeyRow).toHaveBeenCalledWith(expect.anything(), { projectId: 'proj', provider: 'cloudflare' });
        expect(mocks.decrypt).toHaveBeenCalledWith('enc', 'org');
    });

    it('composes the managed account id and token into the same combined form', async () => {
        mocks.resolveKeyRow.mockResolvedValue(null);
        process.env.CLOUDFLARE_API_TOKEN = 'managed-token';
        process.env.CLOUDFLARE_ACCOUNT_ID = 'managed-account';
        await expect(resolveClefKey(supabase, 'proj', 'org')).resolves.toEqual({ key: 'managed-account:managed-token', usesByok: false });
    });

    it('returns null when either managed half is missing', async () => {
        mocks.resolveKeyRow.mockResolvedValue(null);
        process.env.CLOUDFLARE_API_TOKEN = 'managed-token';
        await expect(resolveClefKey(supabase, 'proj', 'org')).resolves.toBeNull();
    });
});

describe('evaluateClefJudgment', () => {
    const request = {
        state: 'Charged twice',
        questions: { refund: { type: 'noul' as const, instructions: 'Requests a refund?' } },
        model: 'clef-latest',
    };

    function upstream(payload: unknown, init?: { status?: number; headers?: Record<string, string> }) {
        return new Response(JSON.stringify(payload), {
            status: init?.status ?? 200,
            headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        });
    }

    it('posts the flagship selector to the clef run endpoint', async () => {
        mocks.safeFetch.mockResolvedValue(upstream({
            success: true,
            result: {
                model: 'clef',
                answers: { refund: { type: 'noul', noul: 0.9 } },
                usage: { input_tokens: 100, completion_tokens: 0 },
            },
            errors: [],
        }));
        const result = await evaluateClefJudgment('acct:token', request);
        expect(result.model).toBe('clef-latest');
        expect(result.answers).toEqual({ refund: { type: 'noul', noul: 0.9 } });
        expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 0 });

        const [url, opts] = mocks.safeFetch.mock.calls[0];
        expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clef');
        expect(opts.headers.Authorization).toBe('Bearer token');
        const body = JSON.parse(opts.body);
        expect(body.model).toBe('clef');
        expect(body.state).toBe('Charged twice');
        expect(body.questions).toEqual(request.questions);
    });

    it('maps clef-flash to its own run endpoint and selector', async () => {
        mocks.safeFetch.mockResolvedValue(upstream({
            success: true,
            result: { model: 'clef-flash', answers: { refund: { type: 'noul', noul: 0.5 } }, usage: { input_tokens: 10, completion_tokens: 0 } },
            errors: [],
        }));
        const result = await evaluateClefJudgment('acct:token', { ...request, model: 'clef-flash' });
        expect(mocks.safeFetch.mock.calls[0][0]).toBe('https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clef-flash');
        expect(JSON.parse(mocks.safeFetch.mock.calls[0][1].body).model).toBe('clef-flash');
        expect(result.model).toBe('clef-flash');
    });

    it('maps clef-omni to its own run endpoint and selector', async () => {
        mocks.safeFetch.mockResolvedValue(upstream({
            success: true,
            result: { model: 'clef-omni', answers: { refund: { type: 'noul', noul: 0.7 } }, usage: { input_tokens: 20, completion_tokens: 0 } },
            errors: [],
        }));
        const result = await evaluateClefJudgment('acct:token', { ...request, model: 'clef-omni' });
        expect(mocks.safeFetch.mock.calls[0][0]).toBe('https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clef-omni');
        expect(JSON.parse(mocks.safeFetch.mock.calls[0][1].body).model).toBe('clef-omni');
        expect(result.model).toBe('clef-omni');
    });

    it('falls back to a token estimate when the envelope omits usage', async () => {
        mocks.safeFetch.mockResolvedValue(upstream({
            success: true,
            result: { answers: { refund: { type: 'noul', noul: 0.5 } } },
            errors: [],
        }));
        const result = await evaluateClefJudgment('acct:token', request);
        expect(result.usage.input_tokens).toBeGreaterThan(0);
        expect(result.usage.output_tokens).toBe(0);
    });

    it('retries rate limits and surfaces auth + validation failures', async () => {
        mocks.safeFetch
            .mockResolvedValueOnce(upstream({ success: false, errors: [{ code: 429, message: 'Rate limited' }] }, { status: 429, headers: { 'retry-after': '0' } }))
            .mockResolvedValueOnce(upstream({
                success: true,
                result: { answers: { refund: { type: 'noul', noul: 0.2 } }, usage: { prompt_tokens: 30, completion_tokens: 0 } },
                errors: [],
            }));
        const result = await evaluateClefJudgment('acct:token', request);
        expect(result.usage.input_tokens).toBe(30);
        expect(mocks.safeFetch).toHaveBeenCalledTimes(2);

        mocks.safeFetch.mockResolvedValue(upstream({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, { status: 401 }));
        await expect(evaluateClefJudgment('acct:token', request)).rejects.toThrowError(/rejected the API key/);

        mocks.safeFetch.mockResolvedValue(upstream({ success: false, errors: [{ code: 7000, message: 'messages.questions.q: bad' }] }, { status: 400 }));
        await expect(evaluateClefJudgment('acct:token', request)).rejects.toThrowError(/rejected the request/);
    });
});

describe('priceClefJudgment', () => {
    it('bills input tokens at the DB rate', async () => {
        mocks.pricingFromDB.mockResolvedValue({ inputPer1KTokens: 0.00024, outputPer1KTokens: 0 });
        // 1M input tokens at $0.24/MTok.
        await expect(priceClefJudgment('clef-latest', 1_000_000)).resolves.toBeCloseTo(0.24, 6);
        expect(mocks.pricingFromDB).toHaveBeenCalledWith('cloudflare', 'clef-latest');
    });
});
