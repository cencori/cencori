/**
 * Installation grant validation + normalization.
 *
 * Grants reference rows in other tables (knowledge_bases, tool_connections).
 * Accepting arbitrary IDs blindly stores joins to nothing — or to another
 * tenant's resources. Every grant write path validates existence, project
 * scope, liveness, and tenant compatibility BEFORE mutating, and normalizes
 * IDs to storage form (KB: bare UUID like POST; connections: raw like POST).
 */

import { dePrefixId } from './http';

type AdminQuery = {
    from: (table: string) => any;
};

export interface GrantCheck {
    projectId: string;
    tenantId: string;
}

export type GrantError = { status: number; code: string; message: string };

export interface ValidatedGrants {
    knowledgeBaseIds: string[];
    connectionIds: string[];
}

/**
 * Validate raw grant ID lists. Returns normalized storage values or the
 * first rejection. Tenant-private resources only attach to their own tenant;
 * group-scoped knowledge bases fail closed (membership is not verifiable at
 * grant time — use tenant or platform scope for shared content).
 */
export async function validateInstallationGrants(
    supabase: AdminQuery,
    scope: GrantCheck,
    input: { knowledgeBaseIds: string[]; connectionIds: string[] },
): Promise<{ ok: true; grants: ValidatedGrants } | { ok: false; error: GrantError }> {
    const kbIds: string[] = [];
    for (const raw of input.knowledgeBaseIds) {
        const id = dePrefixId(raw);
        const { data, error } = await supabase
            .from('knowledge_bases')
            .select('id, status, scope_type, tenant_id')
            .eq('project_id', scope.projectId)
            .eq('id', id)
            .maybeSingle();
        if (error || !data) {
            return { ok: false, error: { status: 404, code: 'knowledge_base_not_found', message: `Knowledge base not found: ${raw}` } };
        }
        const kb = data as { status?: string; scope_type?: string; tenant_id?: string | null };
        if (kb.status !== 'active') {
            return { ok: false, error: { status: 409, code: 'knowledge_base_unavailable', message: `Knowledge base is not active: ${raw}` } };
        }
        const kbTenant = (kb.tenant_id as string | null) ?? null;
        const shared = kb.scope_type === 'platform' || kbTenant === null;
        if (!shared && kb.scope_type === 'group') {
            return { ok: false, error: { status: 403, code: 'knowledge_base_scope_mismatch', message: `Group-scoped knowledge base cannot be granted here: ${raw}` } };
        }
        if (!shared && kbTenant !== scope.tenantId) {
            return { ok: false, error: { status: 403, code: 'knowledge_base_scope_mismatch', message: `Knowledge base belongs to another tenant: ${raw}` } };
        }
        kbIds.push(id);
    }

    const connIds: string[] = [];
    for (const raw of input.connectionIds) {
        const { data, error } = await supabase
            .from('tool_connections')
            .select('id, status, tenant_id')
            .eq('project_id', scope.projectId)
            .eq('id', dePrefixId(raw))
            .maybeSingle();
        if (error || !data) {
            return { ok: false, error: { status: 404, code: 'connection_not_found', message: `Connection not found: ${raw}` } };
        }
        const conn = data as { status?: string; tenant_id?: string | null };
        if (conn.status !== 'active') {
            return { ok: false, error: { status: 409, code: 'connection_unavailable', message: `Connection is not active: ${raw}` } };
        }
        const connTenant = (conn.tenant_id as string | null) ?? null;
        if (connTenant !== null && connTenant !== scope.tenantId) {
            return { ok: false, error: { status: 403, code: 'connection_scope_mismatch', message: `Connection belongs to another tenant: ${raw}` } };
        }
        connIds.push(raw);
    }

    return { ok: true, grants: { knowledgeBaseIds: kbIds, connectionIds: connIds } };
}
