import { describe, expect, it } from 'vitest';
import { ProviderRouter } from '../router';
import { OPENAI_COMPATIBLE_ENDPOINTS } from '../openai-compatible';

describe('Vercel AI Gateway routing', () => {
    it('registers the gateway endpoint', () => {
        expect(OPENAI_COMPATIBLE_ENDPOINTS.vercel.baseURL).toBe('https://ai-gateway.vercel.sh/v1');
    });

    it('routes vercel-prefixed GPT-OSS ids to the gateway', () => {
        const router = new ProviderRouter();
        expect(router.detectProvider('vercel/openai/gpt-oss-20b')).toBe('vercel');
        expect(router.detectProvider('vercel/openai/gpt-oss-120b')).toBe('vercel');
    });

    it('strips exactly the routing prefix so upstream sees the catalog id', () => {
        const router = new ProviderRouter();
        expect(router.normalizeModelName('vercel/openai/gpt-oss-20b', 'vercel')).toBe('openai/gpt-oss-20b');
        expect(router.normalizeModelName('vercel/openai/gpt-oss-120b', 'vercel')).toBe('openai/gpt-oss-120b');
    });

    it('leaves direct Groq/Cerebras routing untouched', () => {
        const router = new ProviderRouter();
        expect(router.detectProvider('openai/gpt-oss-20b')).toBe('groq');
        expect(router.detectProvider('gpt-oss-120b')).toBe('cerebras');
        expect(router.normalizeModelName('openai/gpt-oss-20b', 'groq')).toBe('openai/gpt-oss-20b');
        expect(router.normalizeModelName('gpt-oss-120b', 'cerebras')).toBe('gpt-oss-120b');
    });
});
