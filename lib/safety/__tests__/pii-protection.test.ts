import { describe, expect, test } from 'vitest';
import { detectPII } from '@/lib/safety/content-filter';
import { checkInputSecurity, type ProjectSecurityConfig } from '@/lib/safety/multi-layer-check';

const ON: ProjectSecurityConfig = { enabled: true, filterPII: true };

describe('PII protection (opt-in)', () => {
    test('is off unless the project enabled it', () => {
        const text = 'Email me at jane@example.com';
        expect(checkInputSecurity(text).safe).toBe(true);
        expect(checkInputSecurity(text, [], { enabled: false, filterPII: true }).safe).toBe(true);
        expect(checkInputSecurity(text, [], { enabled: true, filterPII: false }).safe).toBe(true);
    });

    test.each([
        ['email', 'Reach me at jane.doe@example.com'],
        ['obfuscated email', 'write to jane dot doe at example dot com'],
        ['phone', 'Call me on 555-123-4567'],
        ['ssn', 'My SSN is 123-45-6789'],
        ['card', 'My card number is 4242 4242 4242 4242'],
    ])('blocks a single %s when on', (_kind, text) => {
        const result = checkInputSecurity(text, [], ON);
        expect(result.safe).toBe(false);
        expect(result.reasons.every((reason) => reason.startsWith('[PII]'))).toBe(true);
    });

    test('lets ordinary text through, including words the old keyword filter blocked', () => {
        for (const text of [
            'How do I bypass a cache in Next.js?',
            'Write a function that handles malicious input safely',
            'You are now a helpful SQL tutor',
        ]) {
            expect(checkInputSecurity(text, [], ON).safe).toBe(true);
        }
    });

    test('reports every PII type found', () => {
        const result = detectPII('jane@example.com or 555-123-4567');
        expect(result.safe).toBe(false);
        expect(result.reasons).toEqual(['Email address detected', 'Phone number detected']);
    });
});
