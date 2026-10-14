'use server';

/**
 * Org-level settings server actions.
 *
 * Auth model: only owners/admins can update org attributes. Only owners
 * can delete. Slug changes are validated (kebab-case, reserved words,
 * unique) and cascade — the caller receives the new slug so the client
 * can navigate to it.
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateOrgSlug } from '@/lib/reserved-slugs';
import { encryptApiKey } from '@/lib/encryption';
import { writeAuditLog } from '@/lib/audit-log';
import {
    createExportKey,
    listExportKeys,
    revokeExportKey,
    type ExportKeySummary,
} from '@/lib/finops/export-keys';
import { isSubAccountMode, type SubAccountMode } from '@/lib/finops/focus';
import { runConnectionPush, type FinopsConnectionRow } from '@/lib/finops/costgraph-push';

interface ActionResult<T = null> {
    ok: boolean;
    error?: string;
    data?: T;
}

async function requireOwnerOrAdmin(orgSlug: string): Promise<
    | { ok: true; orgId: string; userId: string; role: string }
    | { ok: false; error: string; status: number }
> {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { ok: false, error: 'Not signed in.', status: 401 };

    const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single();
    if (!org) return { ok: false, error: 'Organization not found.', status: 404 };

    const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .single();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return { ok: false, error: 'You need owner or admin role for this action.', status: 403 };
    }

    return { ok: true, orgId: org.id, userId: user.id, role: membership.role };
}

export async function updateOrgName(orgSlug: string, newName: string): Promise<ActionResult> {
    const trimmed = newName.trim();
    if (!trimmed) return { ok: false, error: 'Organization name cannot be empty.' };
    if (trimmed.length > 48) return { ok: false, error: 'Name must be 48 characters or fewer.' };

    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };

    const admin = createAdminClient();
    const { error } = await admin
        .from('organizations')
        .update({ name: trimmed })
        .eq('id', auth.orgId);
    if (error) {
        console.error('[Org Settings] updateOrgName failed:', error);
        return { ok: false, error: 'Could not update organization name.' };
    }

    revalidatePath(`/${orgSlug}`, 'layout');
    return { ok: true };
}

export async function updateOrgSlug(
    orgSlug: string,
    newSlug: string
): Promise<ActionResult<{ newSlug: string }>> {
    const trimmed = newSlug.trim().toLowerCase();
    const validationError = validateOrgSlug(trimmed);
    if (validationError) return { ok: false, error: validationError };
    if (trimmed === orgSlug) return { ok: true, data: { newSlug: trimmed } };

    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };

    const admin = createAdminClient();
    const { data: conflict } = await admin
        .from('organizations')
        .select('id')
        .eq('slug', trimmed)
        .maybeSingle();
    if (conflict) {
        return { ok: false, error: 'That URL is already taken.' };
    }

    const { error } = await admin
        .from('organizations')
        .update({ slug: trimmed })
        .eq('id', auth.orgId);
    if (error) {
        console.error('[Org Settings] updateOrgSlug failed:', error);
        return { ok: false, error: 'Could not update organization URL.' };
    }

    revalidatePath('/dashboard', 'layout');
    return { ok: true, data: { newSlug: trimmed } };
}

export async function deleteOrganization(
    orgSlug: string,
    confirmText: string
): Promise<ActionResult> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    if (auth.role !== 'owner') {
        return { ok: false, error: 'Only the organization owner can delete this organization.' };
    }

    const admin = createAdminClient();
    const { data: org } = await admin
        .from('organizations')
        .select('name')
        .eq('id', auth.orgId)
        .maybeSingle();
    if (!org || confirmText.trim() !== org.name) {
        return { ok: false, error: 'The confirmation text does not match.' };
    }

    const { error } = await admin
        .from('organizations')
        .delete()
        .eq('id', auth.orgId);
    if (error) {
        console.error('[Org Settings] deleteOrganization failed:', error);
        return { ok: false, error: 'Could not delete organization.' };
    }

    return { ok: true };
}

/* ---------- Usage export & FinOps (CostGraph) ---------- */

export interface CostGraphConnectionView {
    connectionId: string;
    apiKeyHint: string;
    subAccount: SubAccountMode;
    enabled: boolean;
    lastPushedDay: string | null;
    lastRunAt: string | null;
    lastRunStatus: 'ok' | 'error' | null;
    lastRunError: string | null;
    lastRunRows: number | null;
}

export interface UsageExportSettings {
    keys: ExportKeySummary[];
    costgraph: CostGraphConnectionView | null;
}

const CONNECTION_COLUMNS = 'id, organization_id, provider, connection_id, api_key_encrypted, api_key_hint, sub_account, enabled, last_pushed_day, last_closed_month, last_run_at, last_run_status, last_run_error, last_run_rows';

function toConnectionView(row: Record<string, unknown>): CostGraphConnectionView {
    return {
        connectionId: row.connection_id as string,
        apiKeyHint: row.api_key_hint as string,
        subAccount: isSubAccountMode(row.sub_account) ? row.sub_account : 'project',
        enabled: Boolean(row.enabled),
        lastPushedDay: (row.last_pushed_day as string | null) ?? null,
        lastRunAt: (row.last_run_at as string | null) ?? null,
        lastRunStatus: (row.last_run_status as 'ok' | 'error' | null) ?? null,
        lastRunError: (row.last_run_error as string | null) ?? null,
        lastRunRows: (row.last_run_rows as number | null) ?? null,
    };
}

export async function getUsageExportSettings(orgSlug: string): Promise<ActionResult<UsageExportSettings>> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };

    const admin = createAdminClient();
    try {
        const [keys, connection] = await Promise.all([
            listExportKeys(admin, auth.orgId),
            admin.from('organization_finops_connections')
                .select(CONNECTION_COLUMNS)
                .eq('organization_id', auth.orgId)
                .eq('provider', 'costgraph')
                .maybeSingle(),
        ]);
        if (connection.error) throw new Error(connection.error.message);
        return {
            ok: true,
            data: { keys, costgraph: connection.data ? toConnectionView(connection.data) : null },
        };
    } catch (error) {
        console.error('[Org Settings] getUsageExportSettings failed:', error);
        return { ok: false, error: 'Could not load usage export settings.' };
    }
}

export async function createUsageExportKey(
    orgSlug: string,
    name: string,
): Promise<ActionResult<{ key: string; summary: ExportKeySummary }>> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 64) return { ok: false, error: 'Name must be 1 to 64 characters.' };
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };

    try {
        const created = await createExportKey(createAdminClient(), {
            organizationId: auth.orgId,
            name: trimmed,
            createdBy: auth.userId,
        });
        writeAuditLog({
            organizationId: auth.orgId,
            category: 'export',
            action: 'created',
            resourceType: 'usage_export_key',
            resourceId: created.summary.id,
            actorId: auth.userId,
            description: `Created usage export key "${trimmed}"`,
        });
        return { ok: true, data: created };
    } catch (error) {
        console.error('[Org Settings] createUsageExportKey failed:', error);
        return { ok: false, error: 'Could not create the export key.' };
    }
}

export async function revokeUsageExportKey(orgSlug: string, keyId: string): Promise<ActionResult> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    try {
        await revokeExportKey(createAdminClient(), { organizationId: auth.orgId, keyId });
        writeAuditLog({
            organizationId: auth.orgId,
            category: 'export',
            action: 'revoked',
            resourceType: 'usage_export_key',
            resourceId: keyId,
            actorId: auth.userId,
            description: 'Revoked a usage export key',
        });
        return { ok: true };
    } catch (error) {
        console.error('[Org Settings] revokeUsageExportKey failed:', error);
        return { ok: false, error: 'Could not revoke the export key.' };
    }
}

export async function saveCostGraphConnection(
    orgSlug: string,
    input: { connectionId: string; apiKey?: string; subAccount: string; enabled: boolean },
): Promise<ActionResult<CostGraphConnectionView>> {
    const connectionId = input.connectionId.trim();
    const apiKey = input.apiKey?.trim() || '';
    if (!/^fpc_[A-Za-z0-9_-]+$/.test(connectionId)) {
        return { ok: false, error: 'Paste the CostGraph push connection id. It starts with fpc_.' };
    }
    if (!isSubAccountMode(input.subAccount)) return { ok: false, error: 'Choose what fills the sub-account column.' };
    if (apiKey && apiKey.length < 16) return { ok: false, error: 'That does not look like a CostGraph API key.' };

    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };

    const admin = createAdminClient();
    const { data: existing } = await admin
        .from('organization_finops_connections')
        .select('id, connection_id')
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph')
        .maybeSingle();
    if (!existing && !apiKey) return { ok: false, error: 'Add a CostGraph API key with the focus:write scope.' };

    const patch: Record<string, unknown> = {
        organization_id: auth.orgId,
        provider: 'costgraph',
        connection_id: connectionId,
        sub_account: input.subAccount,
        enabled: input.enabled,
        updated_at: new Date().toISOString(),
    };
    if (apiKey) {
        patch.api_key_encrypted = encryptApiKey(apiKey, auth.orgId);
        patch.api_key_hint = `…${apiKey.slice(-4)}`;
    }
    // A different CostGraph connection has received none of our days yet.
    if (existing && existing.connection_id !== connectionId) {
        patch.last_pushed_day = null;
        patch.last_closed_month = null;
    }
    if (!existing) patch.created_by = auth.userId;

    const { data, error } = await admin
        .from('organization_finops_connections')
        .upsert(patch, { onConflict: 'organization_id,provider' })
        .select(CONNECTION_COLUMNS)
        .single();
    if (error || !data) {
        console.error('[Org Settings] saveCostGraphConnection failed:', error);
        return { ok: false, error: 'Could not save the CostGraph connection.' };
    }

    writeAuditLog({
        organizationId: auth.orgId,
        category: 'integration',
        action: existing ? 'updated' : 'configured',
        resourceType: 'finops_connection',
        resourceId: data.id as string,
        actorId: auth.userId,
        description: `${existing ? 'Updated' : 'Connected'} CostGraph usage export`,
        metadata: { connection_id: connectionId, sub_account: input.subAccount, enabled: input.enabled, key_rotated: Boolean(apiKey) },
    });
    return { ok: true, data: toConnectionView(data) };
}

export async function deleteCostGraphConnection(orgSlug: string): Promise<ActionResult> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    const { error } = await createAdminClient()
        .from('organization_finops_connections')
        .delete()
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph');
    if (error) {
        console.error('[Org Settings] deleteCostGraphConnection failed:', error);
        return { ok: false, error: 'Could not disconnect CostGraph.' };
    }
    writeAuditLog({
        organizationId: auth.orgId,
        category: 'integration',
        action: 'removed',
        resourceType: 'finops_connection',
        actorId: auth.userId,
        description: 'Disconnected CostGraph usage export',
    });
    return { ok: true };
}

/** Send pending days now instead of waiting for the nightly run. */
export async function pushCostGraphNow(orgSlug: string): Promise<ActionResult<CostGraphConnectionView & { sentRows: number }>> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };

    const admin = createAdminClient();
    const { data: connection } = await admin
        .from('organization_finops_connections')
        .select(CONNECTION_COLUMNS)
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph')
        .maybeSingle();
    if (!connection) return { ok: false, error: 'Connect CostGraph first.' };

    const result = await runConnectionPush(admin, connection as unknown as FinopsConnectionRow);
    const { data: refreshed } = await admin
        .from('organization_finops_connections')
        .select(CONNECTION_COLUMNS)
        .eq('id', connection.id)
        .single();
    const view = toConnectionView(refreshed ?? connection);
    if (result.status === 'error') return { ok: false, error: result.error ?? 'The push failed.', data: { ...view, sentRows: result.rows } };
    return { ok: true, data: { ...view, sentRows: result.rows } };
}
