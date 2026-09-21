/**
 * Live database isolation + concurrency tests for Embedded Agents.
 *
 * Skipped without Supabase credentials (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY). Run with:
 *   npm run test:integration -- __tests__/integration/embedded-isolation.test.ts
 *
 * These prove what unit tests cannot: conditional-claim races, project-scoped
 * credential loads, tenant query isolation, and the composite idempotency key.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
    getTestSupabaseClient,
    isSupabaseAvailable,
    seedTestProject,
    cleanupTestData,
} from './utils/db-helpers';

const runTag = `embiso_${Date.now()}`;
const created = { projects: [] as string[], tenants: [] as string[], sessions: [] as string[], actions: [] as string[], connections: [] as string[] };

async function cleanupEmbedded() {
    if (!isSupabaseAvailable()) return;
    const supabase = getTestSupabaseClient();
    for (const id of created.connections) await supabase.from('tool_connections').delete().eq('id', id);
    for (const id of created.actions) await supabase.from('actions').delete().eq('id', id);
    for (const id of created.sessions) {
        await supabase.from('session_events').delete().eq('session_id', id);
        await supabase.from('sessions').delete().eq('id', id);
    }
    for (const id of created.tenants) {
        await supabase.from('platform_users').delete().eq('tenant_id', id);
        await supabase.from('platform_tenants').delete().eq('id', id);
    }
    await cleanupTestData();
}

describe.skipIf(!isSupabaseAvailable())('embedded live isolation', () => {
    let projectA = '';
    let projectB = '';
    let tenantA1 = '';
    let tenantA2 = '';

    beforeAll(async () => {
        const supabase = getTestSupabaseClient();
        const pa = await seedTestProject({ name: `${runTag}_projA` });
        const pb = await seedTestProject({ name: `${runTag}_projB` });
        projectA = pa.id;
        projectB = pb.id;
        created.projects.push(projectA, projectB);

        for (const [key, ext] of [['A1', 'a1'], ['A2', 'a2']] as const) {
            const { data, error } = await supabase
                .from('platform_tenants')
                .insert({ project_id: projectA, external_id: `${runTag}_${ext}`, name: `Tenant ${ext}`, status: 'active' })
                .select('id')
                .single();
            if (error || !data) throw new Error(`seed tenant failed: ${error?.message}`);
            created.tenants.push(data.id as string);
            if (key === 'A1') tenantA1 = data.id as string;
            else tenantA2 = data.id as string;
        }
    }, 30000);

    afterAll(async () => {
        await cleanupEmbedded();
    });

    it('tenant-scoped session queries never return another tenant rows', async () => {
        const supabase = getTestSupabaseClient();
        // organization_id is required on sessions; fetch it from the project row shape used by seed helpers.
        const { data: proj } = await supabase.from('projects').select('id, organization_id').eq('id', projectA).maybeSingle();
        const orgId = (proj as { organization_id?: string } | null)?.organization_id ?? null;

        for (const [tenantId, marker] of [[tenantA1, 'alpha'], [tenantA2, 'beta']] as const) {
            const { data, error } = await supabase
                .from('sessions')
                .insert({ project_id: projectA, organization_id: orgId, status: 'active', tenant_id: tenantId, external_user_id: `${runTag}_user`, metadata: { marker } })
                .select('id')
                .single();
            if (error || !data) throw new Error(`seed session failed: ${error?.message}`);
            created.sessions.push(data.id as string);
        }

        // The exact query pattern the routes use for ect_ list calls.
        const { data: visible } = await supabase
            .from('sessions')
            .select('id, tenant_id')
            .eq('project_id', projectA)
            .eq('tenant_id', tenantA1)
            .eq('external_user_id', `${runTag}_user`);
        expect((visible ?? []).length).toBeGreaterThan(0);
        for (const row of (visible ?? []) as Array<{ tenant_id: string }>) {
            expect(row.tenant_id).toBe(tenantA1);
        }
    });

    it('concurrent approval claims resolve exactly once', async () => {
        const supabase = getTestSupabaseClient();
        const executionKey = `${runTag}_race`;
        const { data: action, error } = await supabase
            .from('actions')
            .insert({
                project_id: projectA,
                tenant_id: tenantA1,
                tool_name: 'gmail.send',
                risk_level: 'write',
                status: 'pending',
                sanitized_arguments: { to: 'a@example.com' },
                execution_key: executionKey,
            })
            .select('id')
            .single();
        if (error || !action) throw new Error(`seed action failed: ${error?.message}`);
        created.actions.push(action.id as string);

        // Two approvers race the same conditional claim the route uses.
        const claim = () =>
            supabase.from('actions').update({ status: 'approved' }).eq('id', action.id as string).eq('status', 'pending').select('id').maybeSingle();
        const [first, second] = await Promise.all([claim(), claim()]);
        const winners = [first.data, second.data].filter(Boolean);
        expect(winners).toHaveLength(1);
    });

    it('credential loads are project-scoped', async () => {
        const supabase = getTestSupabaseClient();
        const ids: Record<string, string> = {};
        for (const [projectId, tag] of [[projectA, 'a'], [projectB, 'b']] as const) {
            const { data, error } = await supabase
                .from('tool_connections')
                .insert({ project_id: projectId, connector_slug: 'gmail', owner_type: 'tenant', status: 'pending', key_hint: 'test' })
                .select('id')
                .single();
            if (error || !data) throw new Error(`seed connection failed: ${error?.message}`);
            created.connections.push(data.id as string);
            ids[tag] = data.id as string;
        }

        // The approve-route pattern: id + project_id must both match.
        const { data: cross } = await supabase
            .from('tool_connections')
            .select('id')
            .eq('project_id', projectA)
            .eq('id', ids.b)
            .maybeSingle();
        expect(cross).toBeNull();

        const { data: own } = await supabase
            .from('tool_connections')
            .select('id')
            .eq('project_id', projectA)
            .eq('id', ids.a)
            .maybeSingle();
        expect(own).not.toBeNull();
    });

    it('idempotency keys are scoped per project (composite unique)', async () => {
        const supabase = getTestSupabaseClient();
        const key = `${runTag}_shared_key`;
        for (const projectId of [projectA, projectB]) {
            const { data, error } = await supabase
                .from('actions')
                .insert({ project_id: projectId, tool_name: 'test.tool', status: 'pending', sanitized_arguments: {}, execution_key: key })
                .select('id')
                .single();
            // Before the scoping migration this second insert violates the
            // global unique constraint; after it, both succeed.
            if (error) throw new Error(`project-scoped idempotency failed: ${error.message}`);
            if (data) created.actions.push(data.id as string);
        }
    });
});
