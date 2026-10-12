import { describe, expect, it } from 'vitest';
import { openAICacheRetention } from '../openai';
import { openAICompatibleCacheParams } from '../openai-compatible';
import { promptCacheKey } from '@/lib/gateway/v1-responses-execute';

describe('asking providers to cache', () => {
    it('keeps an OpenAI prefix for a day on the families verified to allow it', () => {
        for (const model of ['gpt-5.6-sol', 'gpt-5.4-mini', 'gpt-4.1', 'gpt-4o-mini', 'o3', 'o4-mini']) {
            expect(openAICacheRetention(model), model).toEqual({ prompt_cache_retention: '24h' });
        }
        // An unverified model is sent nothing it might reject.
        expect(openAICacheRetention('gpt-3.5-turbo')).toEqual({});
        expect(openAICacheRetention('o1')).toEqual({});
    });

    it('asks Maximo to cache, and to say what it cached when streaming', () => {
        const request = { promptCacheKey: 'cencori:abc' };
        expect(openAICompatibleCacheParams('maximo', request, { stream: true })).toEqual({
            prompt_cache_key: 'cencori:abc',
            stream_options: { include_usage: true },
        });
        expect(openAICompatibleCacheParams('maximo', request, { stream: false })).toEqual({
            prompt_cache_key: 'cencori:abc',
        });
    });

    it('sends an unverified vendor no parameter it has not been seen to accept', () => {
        for (const provider of ['groq', 'bai', 'cerebras', 'custom']) {
            expect(openAICompatibleCacheParams(provider, { promptCacheKey: 'k' }, { stream: true })).toEqual({});
        }
    });
});

describe('the cache key', () => {
    const project = '1c0a8f5e-4a1b-4c9d-9b0a-2f6e7d8c9a10';

    it('gives each conversation a cache of its own, within the provider limit', () => {
        const one = promptCacheKey('conversation-one', project, 'gpt-5.5');
        const two = promptCacheKey('conversation-two', project, 'gpt-5.5');
        expect(one).not.toBe(two);
        expect(one).toBe(promptCacheKey('conversation-one', project, 'gpt-5.5'));
        expect(one.length).toBeLessThanOrEqual(64);
        expect(promptCacheKey('x'.repeat(500), project, 'gpt-5.5').length).toBeLessThanOrEqual(64);
    });

    it('never lets one project address another project\'s cache', () => {
        expect(promptCacheKey('same-conversation', project, 'gpt-5.5'))
            .not.toBe(promptCacheKey('same-conversation', 'another-project', 'gpt-5.5'));
    });

    it('falls back to the project and model when the client names no conversation', () => {
        expect(promptCacheKey(undefined, project, 'gpt-5.5')).toBe(`cencori:${project}:gpt-5.5`);
        expect(promptCacheKey(42, project, 'gpt-5.5')).toBe(`cencori:${project}:gpt-5.5`);
    });
});
