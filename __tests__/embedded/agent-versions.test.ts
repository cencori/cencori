import { describe, expect, it } from 'vitest';
import { checksumConfig, promoteStableInstallations, validateVersionConfig } from '@/lib/embedded/agents';
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

describe('promoteStableInstallations', () => {
    function fakeDb(result: { data: unknown; error: unknown }) {
        const calls: { table?: string; update?: unknown; filters: Array<[string, unknown]> } = { filters: [] };
        const chain = {
            update(patch: unknown) { calls.update = patch; return chain; },
            eq(column: string, value: unknown) { calls.filters.push([column, value]); return chain; },
            select: async () => result,
        };
        return { calls, db: { from(table: string) { calls.table = table; return chain; } } };
    }

    it('moves only stable-channel installs of the agent onto the new version', async () => {
        const { calls, db } = fakeDb({ data: [{ id: 'a' }, { id: 'b' }], error: null });
        const moved = await promoteStableInstallations(db as never, { projectId: 'p1', agentId: 'ag1', versionId: 'v2' });
        expect(moved).toBe(2);
        expect(calls.table).toBe('agent_installations');
        expect(calls.update).toEqual({ agent_version_id: 'v2' });
        expect(calls.filters).toEqual([['project_id', 'p1'], ['agent_id', 'ag1'], ['update_channel', 'stable']]);
    });

    it('reports a failed update as null instead of throwing', async () => {
        const { db } = fakeDb({ data: null, error: { message: 'boom' } });
        await expect(promoteStableInstallations(db as never, { projectId: 'p1', agentId: 'ag1', versionId: 'v2' })).resolves.toBeNull();
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
