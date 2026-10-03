/**
 * @vitest-environment node
 *
 * Managed embedding retry: transient 429/5xx failures back off and retry
 * (a single throttled call must not fail a whole batch or write); auth and
 * shape errors fail fast. BYOK/OpenAI path is untouched by design.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const genAiMocks = vi.hoisted(() => ({
    embedContent: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: class {
        constructor(..._args: unknown[]) {
            // Real SDK is constructable with the API key; tests drive behavior
            // through the shared embedContent mock below.
        }
        getGenerativeModel() {
            return { embedContent: (...args: unknown[]) => genAiMocks.embedContent(...args) };
        }
    },
}));

vi.mock('@/lib/providers/pricing', () => ({
    getPricingFromDB: vi.fn(async () => ({})),
}));

vi.mock('@/lib/providers/base', () => ({
    calculateProviderTokenCost: vi.fn(() => 0),
}));

import { embedForMemory, isEmbedRetryable } from '../embeddings';

const googleError = (status: number, label: string) =>
    new Error(
        `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent: [${status} ${label}] quota exceeded, please retry`
    );

function mockSupabaseGoogleClaim() {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eqThird = vi.fn(() => ({ maybeSingle }));
    const eqSecond = vi.fn(() => ({ eq: eqThird }));
    const eqFirst = vi.fn(() => ({ eq: eqSecond }));
    const select = vi.fn(() => ({ eq: eqFirst }));
    return {
        from: vi.fn(() => ({ select })),
        rpc: vi.fn(async () => ({ data: [{ embedding_provider: 'google' }], error: null })),
    } as never;
}

describe('isEmbedRetryable', () => {
    it('retries 429 and 5xx in the observed log format', () => {
        expect(isEmbedRetryable(googleError(429, 'Too Many Requests'))).toBe(true);
        expect(isEmbedRetryable(googleError(503, 'Service Unavailable'))).toBe(true);
        expect(isEmbedRetryable(googleError(500, 'Internal'))).toBe(true);
        expect(isEmbedRetryable(googleError(502, 'Bad Gateway'))).toBe(true);
        expect(isEmbedRetryable(googleError(504, 'Deadline Exceeded'))).toBe(true);
    });

    it('retries timeouts and network blips', () => {
        expect(isEmbedRetryable(new Error('Request timed out after 60000ms'))).toBe(true);
        expect(isEmbedRetryable(new Error('fetch failed'))).toBe(true);
        expect(isEmbedRetryable(new Error('ECONNRESET'))).toBe(true);
    });

    it('fails fast on auth/shape errors', () => {
        expect(isEmbedRetryable(googleError(400, 'Bad Request'))).toBe(false);
        expect(isEmbedRetryable(googleError(401, 'Unauthorized'))).toBe(false);
        expect(isEmbedRetryable(googleError(403, 'Forbidden'))).toBe(false);
        expect(isEmbedRetryable(googleError(404, 'Not Found'))).toBe(false);
        expect(isEmbedRetryable(new Error('No Google API key configured for memory embeddings'))).toBe(false);
        expect(isEmbedRetryable(new Error('some other failure'))).toBe(false);
    });
});

describe('embedForMemory retry behavior (managed Gemini path)', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...OLD_ENV, MEMORY_GEMINI_API_KEY: 'test-memory-key' };
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    function mockModel(failures: unknown[]) {
        genAiMocks.embedContent.mockReset();
        genAiMocks.embedContent.mockImplementation(async () => {
            if (failures.length > 0) throw failures.shift();
            return { embedding: { values: [0.1, 0.2, 0.3] } };
        });
        return { embedContent: genAiMocks.embedContent };
    }

    it('rides through two 429s then succeeds', async () => {
        const { embedContent } = mockModel([
            googleError(429, 'Too Many Requests'),
            googleError(429, 'Too Many Requests'),
        ]);
        const result = await embedForMemory(mockSupabaseGoogleClaim(), 'proj_1', 'org_1', 'hello');
        expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]]);
        expect(result.provider).toBe('google');
        expect(embedContent).toHaveBeenCalledTimes(3);
    }, 15000);

    it('throws immediately on a 400 without retrying', async () => {
        const { embedContent } = mockModel([googleError(400, 'Bad Request')]);
        await expect(embedForMemory(mockSupabaseGoogleClaim(), 'proj_1', 'org_1', 'hello')).rejects.toThrow(
            'Bad Request'
        );
        expect(embedContent).toHaveBeenCalledTimes(1);
    });

    it('gives up after three 503s', async () => {
        const { embedContent } = mockModel([
            googleError(503, 'Service Unavailable'),
            googleError(503, 'Service Unavailable'),
            googleError(503, 'Service Unavailable'),
        ]);
        await expect(embedForMemory(mockSupabaseGoogleClaim(), 'proj_1', 'org_1', 'hello')).rejects.toThrow(
            'Service Unavailable'
        );
        expect(embedContent).toHaveBeenCalledTimes(3);
    }, 15000);
});
