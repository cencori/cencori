import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { topicOf } from '@/lib/studio/inbox';

describe('what a customer came for', () => {
    it('takes the first message, greetings off, a few words', () => {
        expect(topicOf('Hi, do you have laptops under 500k?')).toBe('Do you have laptops under 500k');
        expect(topicOf('Good morning please I want to book a table for 6 on Saturday night')).toBe('I want to book a table…');
        expect(topicOf('Hello! Do you deliver to Lekki? Thanks')).toBe('Do you deliver to Lekki');
        expect(topicOf('abeg how much is the jollof')).toBe('How much is the jollof');
    });
    it('is nothing when the message was only a greeting', () => {
        expect(topicOf('Hi')).toBeNull();
        expect(topicOf('Good evening!!')).toBeNull();
        expect(topicOf(null)).toBeNull();
        expect(topicOf("How's it going?")).toBeNull();
        expect(topicOf('Hi, how are you doing today? Do you sell iPhones')).toBe('Do you sell iPhones');
    });
});
