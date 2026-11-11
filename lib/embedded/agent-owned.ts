/**
 * Things an agent owns outright: its product catalog and its payment
 * provider account. Each is a `tool_connections` row carrying the agent in
 * `metadata.agent_id`, so one agent's products and key are never another's.
 *
 * Rows from before this (no agent on them) were shared by the project. The
 * first time one is read it's handed to the agents that were using it: the
 * ones with its tool switched on, or the project's first agent when none has.
 * The one with the most history keeps the row; the others get a copy without
 * the history.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

export interface OwnedKind {
    slug: string;
    /** The system tool that uses it (take_payments, sell_products). */
    tool: string;
    /** How much of the row's history (payments, orders) came from this agent. */
    historyOf(metadata: Row, agentId: string): number;
    /** The metadata for a copy handed to another agent: same content, no history. */
    withoutHistory(metadata: Row): Row;
}

const COLUMNS = 'id, project_id, encrypted_access_ref, key_hint, metadata, created_at';
const agentOf = (row: Row) => {
    const agentId = (row.metadata as Row | null)?.agent_id;
    return typeof agentId === 'string' && agentId ? agentId : null;
};

/** The project's first agent: the one project-wide surfaces (Studio) act for. */
export async function primaryAgentId(db: Admin, projectId: string): Promise<string | null> {
    const { data } = await db.from('agents').select('id').eq('project_id', projectId).order('created_at', { ascending: true }).limit(1).maybeSingle();
    return (data?.id as string | undefined) ?? null;
}

/** Every active row of the kind in the project, oldest first. */
export async function ownedRows(db: Admin, projectId: string, kind: OwnedKind): Promise<Row[]> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('project_id', projectId).eq('connector_slug', kind.slug).eq('status', 'active').order('created_at', { ascending: true }).limit(200);
    return (data ?? []) as Row[];
}

/** The agent's own row; `agentId` null means the project's first agent. */
export async function ownedRow(db: Admin, projectId: string, agentId: string | null, kind: OwnedKind): Promise<Row | null> {
    const owner = agentId || await primaryAgentId(db, projectId);
    if (!owner) return null;
    let rows = await ownedRows(db, projectId, kind);
    const shared = rows.filter((row) => !agentOf(row));
    if (shared.length > 0) {
        for (const row of shared) await handOver(db, projectId, row, kind);
        rows = await ownedRows(db, projectId, kind);
    }
    // Newest first, as a reconnect replaces what was there.
    return rows.filter((row) => agentOf(row) === owner).at(-1) ?? null;
}

const toolOn = (config: unknown, tool: string) => {
    const value = ((config as Row | null)?.system_tools as Row | undefined)?.[tool];
    return value === true || (!!value && typeof value === 'object');
};

/** Give a row from before agents owned these to the agents that were using it. */
async function handOver(db: Admin, projectId: string, row: Row, kind: OwnedKind): Promise<void> {
    const [{ data: agents }, { data: versions }] = await Promise.all([
        db.from('agents').select('id, stable_version_id, created_at').eq('project_id', projectId).order('created_at', { ascending: true }),
        db.from('agent_versions').select('id, agent_id, config_json, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(2_000),
    ]);
    const all = (agents ?? []) as Array<{ id: string; stable_version_id: string | null }>;
    if (all.length === 0) return;
    const rowsOf = (versions ?? []) as Array<{ id: string; agent_id: string; config_json: unknown }>;
    // Using it: the tool is on in the live version or in the latest one.
    const using = all.filter((agent) => {
        const own = rowsOf.filter((version) => version.agent_id === agent.id);
        const live = own.find((version) => version.id === agent.stable_version_id);
        return toolOn(live?.config_json, kind.tool) || toolOn(own[0]?.config_json, kind.tool);
    });
    const metadata = (row.metadata ?? {}) as Row;
    const takers = using.length > 0 ? using : [all[0]];
    const keeper = takers.reduce((best, agent) => (kind.historyOf(metadata, agent.id) > kind.historyOf(metadata, best.id) ? agent : best), takers[0]);
    // Only one caller hands it over: the row is claimed while it still has no agent.
    const { data: claimed } = await db.from('tool_connections').update({ metadata: { ...metadata, agent_id: keeper.id } }).eq('id', row.id as string).is('metadata->>agent_id', null).select('id');
    if (!claimed?.length) return;
    const copies = takers.filter((agent) => agent.id !== keeper.id).map((agent) => ({
        project_id: projectId,
        connector_slug: kind.slug,
        owner_type: 'platform',
        status: 'active',
        encrypted_access_ref: (row.encrypted_access_ref as string | null) ?? null,
        key_hint: (row.key_hint as string | null) ?? null,
        metadata: { ...kind.withoutHistory(metadata), agent_id: agent.id },
    }));
    if (copies.length > 0) await db.from('tool_connections').insert(copies);
}
