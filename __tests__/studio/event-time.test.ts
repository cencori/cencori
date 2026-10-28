import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/studio/studio-data', () => ({ studioFetch: vi.fn() }));
vi.mock('@/components/studio/StudioShell', () => ({ useStudio: vi.fn() }));
import { eventWhen, fromLagosInput, lagosInput } from '@/components/studio/useEvents';

describe('event times are Lagos time on any device', () => {
    it('shows, reads and writes 8pm Lagos as 8pm', () => {
        expect(fromLagosInput('2026-12-20T20:00')).toBe('2026-12-20T19:00:00.000Z');
        expect(lagosInput('2026-12-20T19:00:00.000Z')).toBe('2026-12-20T20:00');
        expect(eventWhen('2026-12-20T19:00:00.000Z')).toBe('Sun 20 Dec · 8:00 pm');
        // Just after midnight in Lagos is still the next day there.
        expect(lagosInput('2026-12-20T23:30:00.000Z')).toBe('2026-12-21T00:30');
    });
});
