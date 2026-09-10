import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '../config';
import { ProviderRouter } from '../router';

/**
 * Groq namespaces the open-weight models it hosts by the lab that produced
 * them: `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `moonshotai/kimi-k2-instruct`.
 * That prefix is part of the id Groq serves, not a routing hint — Groq answers
 * "The model `gpt-oss-120b` does not exist or you do not have access to it" for
 * the bare form.
 *
 * normalizeModelName used to strip any prefix that differed from the detected
 * provider, so every one of these reached Groq without its namespace and 404'd.
 * `groq/compound*` was the only Groq model that worked, because there the prefix
 * happens to equal the provider name. The failure was invisible from the routing
 * side — detectProvider returned `groq` correctly — and it applied to
 * gpt-oss-120b and gpt-oss-20b, which are sold, not just to the free tier.
 *
 * free-tier.test.ts covers the free half of this; the paid models had no
 * coverage at all, which is why it survived.
 *
 * Groq's free Whisper models are deliberately absent here: transcription
 * resolves its provider from STT_MODELS in lib/audio/transcribe.ts and never
 * reaches ProviderRouter.
 */
describe('Groq namespaced model ids', () => {
    const router = new ProviderRouter();
    const groqModels = SUPPORTED_PROVIDERS.find(p => p.id === 'groq')?.models ?? [];

    it('has models to check', () => {
        expect(groqModels.length).toBeGreaterThan(0);
    });

    it('sends every catalog id to Groq exactly as Groq publishes it', () => {
        for (const model of groqModels) {
            expect(router.detectProvider(model.id), `detectProvider(${model.id})`).toBe('groq');
            expect(
                router.normalizeModelName(model.id, 'groq'),
                `${model.id} must keep its namespace upstream`,
            ).toBe(model.id);
        }
    });

    it('keeps the vendor namespace on the paid gpt-oss models', () => {
        // The regression case. Both carry active model_pricing rows.
        for (const id of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
            expect(router.detectProvider(id)).toBe('groq');
            expect(router.normalizeModelName(id, 'groq')).toBe(id);
        }
    });

    it('does not route Groq-hosted ids to the lab named in their prefix', () => {
        // `openai/...` must not reach the paid OpenAI account, and `qwen/...`
        // must not reach the separate Qwen provider.
        expect(router.detectProvider('openai/gpt-oss-safeguard-20b')).toBe('groq');
        expect(router.detectProvider('qwen/qwen3.8-27b')).toBe('groq');
        expect(router.detectProvider('qwen/qwen3.6-27b')).toBe('groq');
        expect(router.detectProvider('moonshotai/kimi-k2-instruct')).toBe('groq');
    });

    it('still strips a genuine routing prefix for providers that are not namespaced', () => {
        // The stripping behaviour itself is correct and must survive the fix.
        // It applies when the prefix names something other than the resolved
        // provider and that provider expects a bare id — Google serves
        // `gemini-2.5-flash`, not `vertex/gemini-2.5-flash`.
        expect(router.normalizeModelName('vertex/gemini-2.5-flash', 'google')).toBe('gemini-2.5-flash');
        // A prefix that matches its provider is a namespace, and is kept.
        expect(router.normalizeModelName('groq/compound', 'groq')).toBe('groq/compound');
    });
});
