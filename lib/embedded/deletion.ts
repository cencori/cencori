import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export interface DeletionSummary {
    tenant_id: string;
    deleted: Record<string, number>;
}

/** M4 hard delete: cascade through tenant-owned resources in FK-safe order. */
export async function cascadeDeleteTenant(supabase: Admin, projectId: string, tenantId: string): Promise<DeletionSummary> {
    const summary: Record<string, number> = {};
    const countDelete = async (table: string, col: string, val: string): Promise<number> => {
        const { data } = await supabase.from(table).select('id').eq(col, val);
        const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
        if (ids.length === 0) {
            summary[table] = 0;
            return 0;
        }
        // Chunk to stay under query limits.
        for (let i = 0; i < ids.length; i += 100) {
            await supabase.from(table).delete().in('id', ids.slice(i, i + 100));
        }
        summary[table] = ids.length;
        return ids.length;
    };

    // Installations + joins.
    const { data: installations } = await supabase.from('agent_installations').select('id').eq('tenant_id', tenantId);
    for (const ins of (installations ?? []) as Array<{ id: string }>) {
        await supabase.from('installation_knowledge_bases').delete().eq('installation_id', ins.id);
        await supabase.from('installation_connections').delete().eq('installation_id', ins.id);
    }
    await countDelete('agent_installations', 'tenant_id', tenantId);

    // Actions, runs (+events), sessions (+events).
    await supabase.from('actions').delete().eq('tenant_id', tenantId).then(
        () => undefined,
        () => undefined,
    );
    const { data: runs } = await supabase.from('embedded_runs').select('id').eq('tenant_id', tenantId);
    for (const run of (runs ?? []) as Array<{ id: string }>) {
        await supabase.from('embedded_run_events').delete().eq('run_id', run.id);
    }
    await countDelete('embedded_runs', 'tenant_id', tenantId);

    const { data: sessions } = await supabase.from('sessions').select('id').eq('tenant_id', tenantId);
    for (const s of (sessions ?? []) as Array<{ id: string }>) {
        await supabase.from('session_events').delete().eq('session_id', s.id);
    }
    await countDelete('sessions', 'tenant_id', tenantId);

    // Knowledge: chunks → sources → grants → bases.
    const { data: kbs } = await supabase.from('knowledge_bases').select('id').eq('tenant_id', tenantId);
    for (const kb of (kbs ?? []) as Array<{ id: string }>) {
        await supabase.from('knowledge_chunks').delete().eq('knowledge_base_id', kb.id);
        await supabase.from('knowledge_sources').delete().eq('knowledge_base_id', kb.id);
        await supabase.from('knowledge_grants').delete().eq('knowledge_base_id', kb.id);
    }
    await countDelete('knowledge_bases', 'tenant_id', tenantId);

    // Connections (tool + provider models are project-scoped, untouched), MCP servers, users.
    await countDelete('tool_connections', 'tenant_id', tenantId);
    await countDelete('mcp_servers', 'tenant_id', tenantId);
    await countDelete('platform_users', 'tenant_id', tenantId);

    // ai_requests dims null out via FK SET NULL; explicitly clear stragglers.
    await supabase.from('ai_requests').update({ tenant_id: null }).eq('project_id', projectId).eq('tenant_id', tenantId);

    // Finally the tenant row.
    await supabase.from('platform_tenants').delete().eq('id', tenantId).eq('project_id', projectId);
    summary['platform_tenants'] = 1;

    return { tenant_id: tenantId, deleted: summary };
}

/** M4 user forget: remove the user row + their user-scoped memories (best-effort). */
export async function hardDeleteUser(supabase: Admin, projectId: string, tenantId: string, externalUserId: string): Promise<void> {
    await supabase.from('gateway_memories').delete().eq('project_id', projectId).eq('scope', 'user').eq('scope_key', externalUserId);
    await supabase.from('platform_users').delete().eq('project_id', projectId).eq('tenant_id', tenantId).eq('external_id', externalUserId);
}
