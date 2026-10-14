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
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateOrgSlug } from '@/lib/reserved-slugs';
import { requireOrgOwnerOrAdmin } from '@/lib/org-admin-access';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { writeAuditLog } from '@/lib/audit-log';
import {
    createExportKey,
    listExportKeys,
    revokeExportKey,
    type ExportKeySummary,
} from '@/lib/finops/export-keys';
import { isSubAccountMode, type SubAccountMode } from '@/lib/finops/focus';
import { runConnectionPush, type FinopsConnectionRow } from '@/lib/finops/costgraph-push';
import {
    COSTGRAPH_OAUTH_PENDING_COOKIE,
    CostGraphCapabilityMissing,
    PENDING_MAX_AGE_MS,
    costgraphOAuthEnabled,
    oauthClientId,
    openSigned,
    revokeToken,
} from '@/lib/finops/costgraph-oauth';
import { decryptTokens, finishCostGraphConnect, type PendingConnect } from '@/lib/finops/costgraph-connect';
import { CostGraphError } from '@/lib/finops/costgraph';
import { resolveConsoleBaseUrl } from '@/lib/auth-redirect';
import { cookies } from 'next/headers';

interface ActionResult<T = null> {
    ok: boolean;
    error?: string;
    data?: T;
}

const requireOwnerOrAdmin = requireOrgOwnerOrAdmin;

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
    /** Null while an OAuth connection waits for CostGraph to create the push connection. */
    connectionId: string | null;
    authMethod: 'api_key' | 'oauth';
    apiKeyHint: string | null;
    tenantName: string | null;
    subAccount: SubAccountMode;
    enabled: boolean;
    lastPushedDay: string | null;
    lastRunAt: string | null;
    lastRunStatus: 'ok' | 'error' | null;
    lastRunError: string | null;
    lastRunRows: number | null;
}

export interface UsageExportSettings {
    organizationId: string;
    keys: ExportKeySummary[];
    costgraph: CostGraphConnectionView | null;
    /** "Connect CostGraph" (OAuth) is switched on for this deployment. */
    oauthAvailable: boolean;
    /** Set after signing in to CostGraph with access to several tenants, until one is picked. */
    pendingTenants: Array<{ id: string; name: string }> | null;
}

// '*' rather than a column list: the OAuth columns arrive by a later migration, and naming them
// here would break this page until it is applied. toConnectionView picks what it needs.
const CONNECTION_COLUMNS = '*';

async function readPendingConnect(orgId: string): Promise<PendingConnect | null> {
    const jar = await cookies();
    const pending = openSigned<PendingConnect>(jar.get(COSTGRAPH_OAUTH_PENDING_COOKIE)?.value, PENDING_MAX_AGE_MS);
    return pending && pending.organizationId === orgId ? pending : null;
}

async function clearPendingConnect(): Promise<void> {
    const jar = await cookies();
    jar.set(COSTGRAPH_OAUTH_PENDING_COOKIE, '', { path: '/', maxAge: 0 });
}

function toConnectionView(row: Record<string, unknown>): CostGraphConnectionView {
    return {
        connectionId: (row.connection_id as string | null) ?? null,
        authMethod: row.auth_method === 'oauth' ? 'oauth' : 'api_key',
        apiKeyHint: (row.api_key_hint as string | null) ?? null,
        tenantName: (row.costgraph_tenant_name as string | null) ?? null,
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
        const pending = await readPendingConnect(auth.orgId);
        return {
            ok: true,
            data: {
                organizationId: auth.orgId,
                keys,
                costgraph: connection.data ? toConnectionView(connection.data) : null,
                oauthAvailable: costgraphOAuthEnabled(orgSlug),
                pendingTenants: pending ? pending.tenants : null,
            },
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
        .select('id, connection_id, sub_account, last_pushed_day')
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph')
        .maybeSingle();
    if (!existing && !apiKey) return { ok: false, error: 'Add a CostGraph API key with the focus:write scope.' };
    // The sub-account is part of each record's identity, and CostGraph keeps every record it has
    // ingested: changing it after a push would count the history twice. A new connection may choose.
    if (existing?.last_pushed_day && existing.connection_id === connectionId && existing.sub_account !== input.subAccount) {
        return { ok: false, error: 'The sub-account is fixed once usage has been sent to this CostGraph connection.' };
    }

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

    // Saving a pasted key makes this an API-key connection, so any OAuth grant on the row goes.
    // Those columns arrive by a later migration; without it, save the API-key fields alone.
    const oauthReset = {
        auth_method: 'api_key',
        oauth_access_token_encrypted: null,
        oauth_refresh_token_encrypted: null,
        oauth_access_expires_at: null,
        oauth_refresh_lease_until: null,
    };
    let { data, error } = await admin
        .from('organization_finops_connections')
        .upsert({ ...patch, ...oauthReset }, { onConflict: 'organization_id,provider' })
        .select(CONNECTION_COLUMNS)
        .single();
    if (error && /auth_method|oauth_/.test(error.message ?? '')) {
        ({ data, error } = await admin
            .from('organization_finops_connections')
            .upsert(patch, { onConflict: 'organization_id,provider' })
            .select(CONNECTION_COLUMNS)
            .single());
    }
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
    const admin = createAdminClient();
    const { data: existing } = await admin
        .from('organization_finops_connections')
        .select(CONNECTION_COLUMNS)
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph')
        .maybeSingle();
    const { error } = await admin
        .from('organization_finops_connections')
        .delete()
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph');
    if (error) {
        console.error('[Org Settings] deleteCostGraphConnection failed:', error);
        return { ok: false, error: 'Could not disconnect CostGraph.' };
    }
    // An OAuth connection holds a grant on the user's CostGraph account; end it too.
    const refresh = (existing as Record<string, unknown> | null)?.oauth_refresh_token_encrypted;
    if (typeof refresh === 'string') {
        try {
            await revokeToken({ token: decryptApiKey(refresh, auth.orgId), clientId: oauthClientId(resolveConsoleBaseUrl()) });
        } catch (revokeError) {
            console.error('[Org Settings] CostGraph token revoke failed:', revokeError);
        }
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

/** Pause or resume the nightly push, whichever way the connection authenticates. */
export async function setCostGraphEnabled(orgSlug: string, enabled: boolean): Promise<ActionResult<CostGraphConnectionView>> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    const { data, error } = await createAdminClient()
        .from('organization_finops_connections')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph')
        .select(CONNECTION_COLUMNS)
        .single();
    if (error || !data) return { ok: false, error: 'Could not update the CostGraph connection.' };
    writeAuditLog({
        organizationId: auth.orgId,
        category: 'integration',
        action: enabled ? 'activated' : 'deactivated',
        resourceType: 'finops_connection',
        resourceId: (data as Record<string, unknown>).id as string,
        actorId: auth.userId,
        description: `${enabled ? 'Resumed' : 'Paused'} the CostGraph usage push`,
    });
    return { ok: true, data: toConnectionView(data) };
}

/** Finish "Connect CostGraph" with the tenant the user picked. */
export async function completeCostGraphConnect(orgSlug: string, tenantId: string): Promise<ActionResult<CostGraphConnectionView>> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    const pending = await readPendingConnect(auth.orgId);
    if (!pending || pending.userId !== auth.userId) {
        return { ok: false, error: 'That CostGraph sign-in has expired. Connect again.' };
    }
    const tenant = pending.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { ok: false, error: 'Choose one of your CostGraph tenants.' };

    const admin = createAdminClient();
    try {
        await finishCostGraphConnect({
            supabase: admin,
            organizationId: auth.orgId,
            userId: auth.userId,
            tokens: decryptTokens(pending.tokensEncrypted, auth.orgId),
            subject: pending.subject,
            tenant,
            clientId: oauthClientId(resolveConsoleBaseUrl()),
        });
    } catch (error) {
        await clearPendingConnect();
        console.error('[Org Settings] completeCostGraphConnect failed:', error);
        return {
            ok: false,
            error: error instanceof CostGraphCapabilityMissing
                ? 'CostGraph does not support connecting from Cencori yet.'
                : error instanceof CostGraphError && error.status === 403
                    ? 'Connecting needs an owner, admin or billing admin role in that CostGraph organization.'
                    : 'Could not finish connecting CostGraph.',
        };
    }
    await clearPendingConnect();
    const { data } = await admin
        .from('organization_finops_connections')
        .select(CONNECTION_COLUMNS)
        .eq('organization_id', auth.orgId)
        .eq('provider', 'costgraph')
        .single();
    return data ? { ok: true, data: toConnectionView(data) } : { ok: false, error: 'Connected, but could not read it back.' };
}

/** Abandon a pending "Connect CostGraph" and end the grant it holds. */
export async function cancelCostGraphConnect(orgSlug: string): Promise<ActionResult> {
    const auth = await requireOwnerOrAdmin(orgSlug);
    if (!auth.ok) return { ok: false, error: auth.error };
    const pending = await readPendingConnect(auth.orgId);
    if (pending) {
        try {
            const tokens = decryptTokens(pending.tokensEncrypted, auth.orgId);
            await revokeToken({ token: tokens.refreshToken, clientId: oauthClientId(resolveConsoleBaseUrl()) });
        } catch {
            // The grant expires on its own; clearing the cookie is what matters here.
        }
    }
    await clearPendingConnect();
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
