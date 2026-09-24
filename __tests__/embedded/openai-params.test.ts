import { describe, expect, it } from 'vitest';
import { openAICompletionLimits } from '@/lib/providers/openai';

describe('OpenAI completion parameters', () => {
    it('uses modern token limits without unsupported sampling parameters for GPT-5', () => {
        expect(openAICompletionLimits({ model: 'gpt-5.6-luna', maxTokens: 500 })).toEqual({
            temperature: undefined,
            max_completion_tokens: 500,
        });
    });

    it('keeps legacy-model sampling behavior', () => {
        expect(openAICompletionLimits({ model: 'gpt-4o-mini', maxTokens: 500 })).toEqual({
            temperature: 0.7,
            max_completion_tokens: 500,
        });
    });
});
