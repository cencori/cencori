import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { AgentToolset } from './agent-tools';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The installed agent's own tools for a session, as the turn that paused had
 * them: the installation's published version, plus what the business switched
 * on in Studio. Null when the session has no active installation.
 */
export async function loadSessionAgentTools(
    db: Admin,
    projectId: string,
    session: { installation_id?: string | null; agent_id?: string | null },
): Promise<{ toolset: AgentToolset; agentId: string } | null> {
    if (!session.installation_id) return null;
    const { data: ins } = await db
        .from('agent_installations')
        .select('agent_id, agent_version_id, status')
        .eq('project_id', projectId)
        .eq('id', session.installation_id)
        .maybeSingle();
    const installation = ins as { agent_id?: string | null; agent_version_id?: string | null; status?: string } | null;
    const agentId = session.agent_id ?? installation?.agent_id ?? null;
    if (!installation || installation.status !== 'active' || !installation.agent_version_id || !agentId) return null;
    const { data: version } = await db
        .from('agent_versions')
        .select('config_json, status')
        .eq('project_id', projectId)
        .eq('id', installation.agent_version_id)
        .maybeSingle();
    const v = version as { config_json?: Record<string, unknown> | null; status?: string } | null;
    if (!v || v.status !== 'published') return null;
    const [takesTransfers, takesBookings] = await Promise.all([
        import('./transfers').then(({ takesTransfersCached }) => takesTransfersCached(db as never, projectId)).catch(() => false),
        import('@/lib/studio/schedule').then(({ takesBookingsCached }) => takesBookingsCached(db as never, projectId)).catch(() => false),
    ]);
    const { agentToolset } = await import('./agent-tools');
    const toolset = agentToolset(v.config_json ?? {}, { takesTransfers, takesBookings });
    toolset.warm(projectId);
    return { toolset, agentId };
}
