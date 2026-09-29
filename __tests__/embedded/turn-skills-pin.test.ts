import { describe, expect, it } from 'vitest';
import { retrieveTurnSkills } from '@/lib/embedded/turn-knowledge';

function fakeDb(tables: Record<string, Array<Record<string, unknown>>>) {
    const api: Record<string, unknown> = {};
    const state = { table: '', filters: [] as Array<(r: Record<string, unknown>) => boolean>, limitN: null as number | null };
    const run = () => {
        let out = (tables[state.table] ?? []).filter((r) => state.filters.every((f) => f(r)));
        if (state.limitN !== null) out = out.slice(0, state.limitN);
        return out;
    };
    Object.assign(api, {
        from: (table: string) => (state.table = table, state.filters = [], state.limitN = null, api),
        select: () => api,
        eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), api),
        in: (col: string, vals: unknown) => (state.filters.push((r) => (vals as unknown[]).includes(r[col])), api),
        limit: (n: number) => (state.limitN = n, api),
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: run(), error: null }),
    });
    return { from: api.from };
}

const skillRow = (id: string) => ({
    id,
    content: `procedure-${id}`,
    status: 'published',
    skill_id: `s-${id}`,
});

const skillParent = (id: string, tenant: string | null = null) => ({
    id: `s-${id}`,
    tenant_id: tenant,
    status: 'active',
});

describe('retrieveTurnSkills version pinning', () => {
    it('uses the submitted version instead of the live installation version', async () => {
        const db = fakeDb({
            agent_installations: [{ id: 'ins1', agent_version_id: 'v-live' }],
            agent_version_skills: [
                { skill_version_id: 'sk-old', agent_version_id: 'v-live' },
                { skill_version_id: 'sk-new', agent_version_id: 'v-pinned' },
            ],
            skill_versions: [skillRow('sk-old'), skillRow('sk-new')],
            skills: [skillParent('sk-old'), skillParent('sk-new')],
        });
        // Live lookup (no pin): old skills.
        const live = await retrieveTurnSkills(db as never, { installationId: 'ins1', tenantId: null });
        expect(live.skill_version_ids).toEqual(['sk-old']);
        // Submission pin: new skills even though the installation moved on.
        const pinned = await retrieveTurnSkills(db as never, { installationId: 'ins1', tenantId: null, versionId: 'v-pinned' });
        expect(pinned.skill_version_ids).toEqual(['sk-new']);
        expect(pinned.block).toContain('procedure-sk-new');
    });

    it('returns empty when the pinned version has no skills', async () => {
        const db = fakeDb({ agent_installations: [], agent_version_skills: [], skill_versions: [] });
        const res = await retrieveTurnSkills(db as never, { installationId: 'ins1', tenantId: null, versionId: 'v-empty' });
        expect(res).toEqual({ block: null, skill_version_ids: [] });
    });

    it('flags read failures instead of silently returning empty', async () => {
        const db = { from: () => { throw new Error('db down'); } };
        const res = await retrieveTurnSkills(db as never, { installationId: 'ins1', tenantId: null, versionId: 'v1' });
        expect(res).toEqual({ block: null, skill_version_ids: [], failed: true });
    });
});
