import { describe, expect, it } from 'vitest';
import { openAIImageParams } from '@/lib/images/openai-params';

describe('OpenAI image request', () => {
    it.each(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'])('never sends response_format or style to %s', (model) => {
        const params = openAIImageParams({ prompt: 'a cat', responseFormat: 'url', style: 'vivid', quality: 'hd', n: 3 }, model);
        expect(params).not.toHaveProperty('response_format');
        expect(params).not.toHaveProperty('style');
        expect(params).toEqual({ model, prompt: 'a cat', n: 1, size: '1024x1024', quality: 'high' });
    });

    it('sends nothing extra when the caller sets nothing', () => {
        expect(Object.keys(openAIImageParams({ prompt: 'a cat' }, 'gpt-image-1')).sort()).toEqual(['model', 'n', 'prompt', 'quality', 'size']);
    });
});
