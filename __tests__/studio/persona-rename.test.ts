import { describe, expect, it } from 'vitest';
import { formerNames, personaInstructions } from '@/lib/studio/persona';

const base = { tone: 'warm' as const, style: '', language: 'customer' as const, emoji: false };

describe('renaming an employee', () => {
    it('keeps the old name, latest first, never the new one, no repeats', () => {
        expect(formerNames([], { from: 'Ada', to: 'Zara' })).toEqual(['Ada']);
        expect(formerNames(['Ada'], { from: 'Zara', to: 'Tolu' })).toEqual(['Zara', 'Ada']);
        // Renamed back to Ada: Ada isn't a former name any more.
        expect(formerNames(['Zara', 'Ada'], { from: 'Tolu', to: 'ada' })).toEqual(['Tolu', 'Zara']);
        expect(formerNames(['Ada'])).toEqual(['Ada']);
    });

    it('tells the employee it was renamed, so old messages do not carry the old name on', () => {
        const text = personaInstructions('Zara', { ...base, former_names: ['Ada'] });
        expect(text).toContain('Your name is Zara');
        expect(text).toContain('used to be called Ada');
        expect(text).toContain('never as Ada');
        expect(personaInstructions('Zara', base)).not.toContain('renamed');
    });
});
