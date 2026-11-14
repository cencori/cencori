import { withPrefix } from './http';

/** Fields that carry an id the API returns with a prefix, and that prefix. */
const ID_PREFIX: Record<string, string> = {
    action_id: 'act',
    tenant_id: 'ten',
    run_id: 'run',
    parent_run_id: 'run',
    child_run_id: 'run',
    installation_id: 'ins',
};

const BARE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Webhook data as the API would return it: `act_…`, `ten_…`, `run_…`, `ins_…`.
 * A receiver matches a webhook against an API response by id, so the two have
 * to be spelled the same. Only bare ids are touched; anything else passes through.
 */
export function withPublicIds(data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...data };
    for (const [field, prefix] of Object.entries(ID_PREFIX)) {
        const value = out[field];
        if (typeof value === 'string' && BARE_UUID.test(value)) out[field] = withPrefix(prefix, value);
    }
    return out;
}

/** An action as every actions endpoint returns it. */
export function serializeAction(row: Record<string, unknown>) {
    return {
        id: withPrefix('act', row.id as string),
        tool: row.tool_name,
        risk_level: row.risk_level,
        status: row.status,
        arguments: row.sanitized_arguments ?? {},
        approval_policy: row.approval_policy ?? {},
        tenant_id: row.tenant_id ? withPrefix('ten', row.tenant_id as string) : null,
        run_id: row.run_id ? withPrefix('run', row.run_id as string) : null,
        session_id: row.session_id ?? null,
        expires_at: row.expires_at ?? null,
        approved_by: row.approved_by ?? null,
        resolved_at: row.resolved_at ?? null,
        result: row.result ?? null,
        error: row.error ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/** What every `action.*` webhook says about the action it is for. */
export function actionEventData(row: {
    id: string;
    tool_name?: string | null;
    tenant_id?: string | null;
    run_id?: string | null;
    session_id?: string | null;
}): Record<string, unknown> {
    return {
        action_id: row.id,
        tool: row.tool_name ?? null,
        tenant_id: row.tenant_id ?? null,
        run_id: row.run_id ?? null,
        session_id: row.session_id ?? null,
    };
}
