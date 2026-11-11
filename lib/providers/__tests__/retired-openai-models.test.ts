import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { ProviderRouter } from '@/lib/providers/router';

describe('retired OpenAI models', () => {
    it('GPT-4.1 Nano is out of the catalog', () => {
        const ids = SUPPORTED_PROVIDERS.flatMap((p) => p.models.map((m) => m.id));
        expect(ids).not.toContain('gpt-4.1-nano');
        expect(ids).toContain('gpt-5-nano');
    });

    it('callers still sending GPT-4.1 Nano get GPT-5 Nano', () => {
        const router = new ProviderRouter();
        expect(router.detectProvider('gpt-4.1-nano')).toBe('openai');
        expect(router.normalizeModelName('gpt-4.1-nano', 'openai')).toBe('gpt-5-nano');
    });
});
