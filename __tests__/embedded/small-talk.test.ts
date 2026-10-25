import { describe, expect, it } from 'vitest';
import { isSmallTalk } from '@/lib/embedded/turn-knowledge';

describe('isSmallTalk', () => {
    it('skips greetings, thanks and one-word acknowledgements', () => {
        for (const text of ['Hi', 'hello!', 'Hey there', 'Good morning', 'thanks!!', 'Thank you so much', 'ok', 'Okay.', 'bye 👋', 'How are you?', "what's up"]) {
            expect(isSmallTalk(text), text).toBe(true);
        }
    });

    it('still searches anything with a question or content in it', () => {
        for (const text of ['Hi, what does it cost?', 'hello can I book a demo', 'thanks, and what about refunds?', 'ok so how do I cancel', 'pricing', '']) {
            expect(isSmallTalk(text), text).toBe(false);
        }
    });
});
