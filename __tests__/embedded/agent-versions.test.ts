import { describe, expect, it } from 'vitest';
import { checksumConfig, validateVersionConfig } from '@/lib/embedded/agents';
import { canTransition, RUN_TERMINAL } from '@/lib/embedded/runs';

describe('agent versions', () => {
    it('rejects invalid configs', () => {
        expect(validateVersionConfig({ model: '' }).ok).toBe(false);
        expect(validateVersionConfig({ temperature: 5 }).ok).toBe(false);
        expect(validateVersionConfig({ tools: 'x' as never }).ok).toBe(false);
        expect(validateVersionConfig({ model: 'gpt-4o', temperature: 0.7 }).ok).toBe(true);
    });

    it('checksums configs deterministically', () => {
        const a = checksumConfig({ model: 'gpt-4o' });
        const b = checksumConfig({ model: 'gpt-4o' });
        const c = checksumConfig({ model: 'gpt-5' });
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });
});

describe('run lifecycle', () => {
    it('allows queued → running → completed', () => {
        expect(canTransition('queued', 'running')).toBe(true);
        expect(canTransition('running', 'completed')).toBe(true);
    });

    it('blocks transitions out of terminal states', () => {
        for (const terminal of RUN_TERMINAL) {
            expect(canTransition(terminal, 'running')).toBe(false);
            expect(canTransition(terminal, 'queued')).toBe(false);
        }
    });

    it('allows cancel from active states only', () => {
        expect(canTransition('queued', 'cancelled')).toBe(true);
        expect(canTransition('running', 'cancelled')).toBe(true);
        expect(canTransition('completed', 'cancelled')).toBe(false);
    });
});
