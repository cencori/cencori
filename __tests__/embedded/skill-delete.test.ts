import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;
const db: { tables: Record<string, Row[]> } = { tables: {} };

/** In-memory PostgREST stand-in: eq/in filters, select, delete. */
function fakeClient() {
    return {
        from(table: string) {
            const filters: Array<(r: Row) => boolean> = [];
            let deleting = false;
            const q: Record<string, unknown> = {
                select: () => q,
                delete: () => (deleting = true, q),
                eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), q),
                in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), q),
                then: (resolve: (v: unknown) => void) => {
                    const rows = db.tables[table] ?? [];
                    const hit = rows.filter((r) => filters.every((f) => f(r)));
                    if (deleting) {
                        db.tables[table] = rows.filter((r) => !hit.includes(r));
                        // Mirror ON DELETE CASCADE from skills to skill_versions.
                        if (table === 'skills') {
                            const gone = hit.map((r) => r.id);
                            db.tables.skill_versions = (db.tables.skill_versions ?? []).filter((v) => !gone.includes(v.skill_id));
                        }
                    }
                    resolve({ data: hit, error: null });
                },
            };
            return q;
        },
    };
}

const auth = vi.hoisted(() => ({ keyType: 'secret' }));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => fakeClient() }));
vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: async () => ({ success: true, context: { projectId: 'proj_1', keyType: auth.keyType } }),
    addGatewayHeaders: (res: unknown) => res,
    handleCorsPreFlight: () => new Response(null),
}));
vi.mock('@/lib/embedded/skills', () => ({
    loadSkill: async (_s: unknown, projectId: string, skillId: string) =>
        (db.tables.skills ?? []).find((r) => r.id === skillId.replace(/^skl_/, '') && r.project_id === projectId) ?? null,
    serializeSkill: (row: Row) => ({ ...row, id: `skl_${row.id}` }),
}));

import { DELETE } from '@/app/api/v1/skills/[skillId]/route';

const call = (id: string, query = '') =>
    DELETE(new NextRequest(`http://x/api/v1/skills/${id}${query}`, { method: 'DELETE' }), { params: Promise.resolve({ skillId: id }) });

beforeEach(() => {
    auth.keyType = 'secret';
    db.tables = {
        skills: [{ id: 's1', project_id: 'proj_1' }, { id: 's2', project_id: 'proj_other' }],
        skill_versions: [{ id: 'v1', skill_id: 's1' }, { id: 'v2', skill_id: 's1' }, { id: 'v9', skill_id: 's2' }],
        agent_version_skills: [],
    };
});

describe('DELETE /v1/skills/:id', () => {
    it('deletes an unpinned skill and its versions', async () => {
        const res = await call('skl_s1');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ id: 'skl_s1', deleted: true, versions_deleted: 2, agent_versions_unpinned: 0 });
        expect(db.tables.skills.map((r) => r.id)).toEqual(['s2']);
        expect(db.tables.skill_versions.map((r) => r.id)).toEqual(['v9']);
    });

    it('refuses while an agent version pins it, and names the agent versions', async () => {
        db.tables.agent_version_skills = [{ agent_version_id: 'a1', skill_version_id: 'v2' }];
        const res = await call('skl_s1');
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe('skill_in_use');
        expect(body.error.message).toContain('force=true');
        expect(body.error.details.agent_version_ids).toEqual(['agv_a1']);
        expect(db.tables.skills).toHaveLength(2);
        expect(db.tables.agent_version_skills).toHaveLength(1);
    });

    it('unpins and deletes with force, leaving other skills\' pins alone', async () => {
        db.tables.agent_version_skills = [
            { agent_version_id: 'a1', skill_version_id: 'v1' },
            { agent_version_id: 'a1', skill_version_id: 'v2' },
            { agent_version_id: 'a2', skill_version_id: 'v9' },
        ];
        const res = await call('skl_s1', '?force=true');
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ deleted: true, versions_deleted: 2, agent_versions_unpinned: 1 });
        expect(db.tables.agent_version_skills).toEqual([{ agent_version_id: 'a2', skill_version_id: 'v9' }]);
        expect(db.tables.skills.map((r) => r.id)).toEqual(['s2']);
    });

    it('cannot delete another project\'s skill', async () => {
        const res = await call('skl_s2', '?force=true');
        expect(res.status).toBe(404);
        expect(db.tables.skills).toHaveLength(2);
    });

    it('requires a secret key', async () => {
        auth.keyType = 'publishable';
        const res = await call('skl_s1');
        expect(res.status).toBe(403);
        expect(db.tables.skills).toHaveLength(2);
    });
});
