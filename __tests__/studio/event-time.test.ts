import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/studio/studio-data', () => ({ studioFetch: vi.fn() }));
vi.mock('@/components/studio/StudioShell', () => ({ useStudio: vi.fn() }));
import { eventWhen, fromZoneInput, zoneInput } from '@/components/studio/useEvents';

describe('event times are on the business clock, on any device', () => {
    it('shows, reads and writes 8pm Lagos as 8pm', () => {
        expect(fromZoneInput('2026-12-20T20:00', 'Africa/Lagos')).toBe('2026-12-20T19:00:00.000Z');
        expect(zoneInput('2026-12-20T19:00:00.000Z', 'Africa/Lagos')).toBe('2026-12-20T20:00');
        expect(eventWhen('2026-12-20T19:00:00.000Z', 'Africa/Lagos')).toBe('Sun 20 Dec · 8:00 pm');
        // Just after midnight in Lagos is still the next day there.
        expect(zoneInput('2026-12-20T23:30:00.000Z', 'Africa/Lagos')).toBe('2026-12-21T00:30');
    });

    it('does the same for a business elsewhere, through daylight saving', () => {
        expect(fromZoneInput('2026-12-20T20:00', 'Europe/London')).toBe('2026-12-20T20:00:00.000Z');
        expect(fromZoneInput('2026-07-04T20:00', 'Europe/London')).toBe('2026-07-04T19:00:00.000Z');
        expect(zoneInput('2026-07-04T19:00:00.000Z', 'Europe/London')).toBe('2026-07-04T20:00');
        expect(eventWhen('2026-11-02T14:30:00.000Z', 'America/New_York')).toBe('Mon 2 Nov · 9:30 am');
    });
});
