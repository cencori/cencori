import { describe, expect, it } from 'vitest';
import { displaySessionStatus, IDLE_AFTER_MS, sessionPreview } from '../preview';

describe('sessionPreview', () => {
    it('shows what the user wrote and names the files', () => {
        expect(sessionPreview('How much is due?\n[Attached file: invoice.pdf]\nINVOICE 1042\nTotal: 48,210\n[Attached file: notes.txt]\nhello'))
            .toEqual({ text: 'How much is due?', files: ['invoice.pdf', 'notes.txt'] });
    });
    it('leaves plain messages alone', () => {
        expect(sessionPreview('Where is order 1042?')).toEqual({ text: 'Where is order 1042?', files: [] });
    });
    it('handles a message that is only a file', () => {
        expect(sessionPreview('[Attached file: a.pdf]\ncontents')).toEqual({ text: null, files: ['a.pdf'] });
    });
    it('handles no input', () => {
        expect(sessionPreview(null)).toEqual({ text: null, files: [] });
    });
});

describe('displaySessionStatus', () => {
    const now = Date.parse('2026-11-08T18:00:00Z');
    it('keeps a recently used session active', () => {
        expect(displaySessionStatus('active', new Date(now - 60_000).toISOString(), now)).toBe('active');
    });
    it('shows an unused session as idle', () => {
        expect(displaySessionStatus('active', new Date(now - IDLE_AFTER_MS - 1).toISOString(), now)).toBe('idle');
    });
    it('leaves other statuses alone', () => {
        expect(displaySessionStatus('paused', new Date(0).toISOString(), now)).toBe('paused');
    });
});
