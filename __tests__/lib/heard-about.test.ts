import { describe, expect, it } from 'vitest';
import { HEARD_ABOUT_OPTIONS, heardAboutLabel, isHeardAboutSource, readHeardAbout } from '@/lib/heard-about';

describe('how did you hear about us', () => {
    it('accepts only the listed answers', () => {
        expect(isHeardAboutSource('instagram')).toBe(true);
        expect(isHeardAboutSource('myspace')).toBe(false);
        expect(HEARD_ABOUT_OPTIONS.at(-1)?.id).toBe('other');
    });

    it('reads an answer kept on a user, and ignores anything else', () => {
        const answer = { source: 'friend', detail: 'Tolu', surface: 'onboarding', at: '2026-10-28T09:00:00Z' };
        expect(readHeardAbout({ heard_about: answer })).toEqual(answer);
        expect(readHeardAbout({ heard_about: { source: 'nope' } })).toBeNull();
        expect(readHeardAbout({})).toBeNull();
        expect(heardAboutLabel('search')).toBe('Google search');
    });
});
