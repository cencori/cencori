/**
 * The last step of "Connect CostGraph": create the push connection in the chosen tenant and store
 * the organization's connection with its OAuth tokens.
 *
 * Nothing is written until CostGraph has created the push connection, so a failed or abandoned
 * sign-in never replaces a working API-key connection with a half-made one.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { writeAuditLog } from '@/lib/audit-log';
import {
    createPushConnection,
    encryptedTokenColumns,
    revokeToken,
    type CostGraphTenant,
    type TokenSet,
} from './costgraph-oauth';

/** Tokens and tenants held in the pending cookie while the user picks a tenant. */
export interface PendingConnect {
    organizationId: string;
    orgSlug: string;
    userId: string;
    /**
     * Only the refresh token, encrypted with the organization's key. The access token is a signed
     * JWT; with it the cookie outgrew the browser's 4 KB limit and was silently dropped. A fresh
     * access token is fetched when the tenant is chosen.
     */
    refreshTokenEncrypted: string;
    subject: string | null;
    tenants: CostGraphTenant[];
    returnTo: string;
    issuedAt: number;
}

export function encryptRefreshToken(tokens: TokenSet, organizationId: string): string {
    return encryptApiKey(tokens.refreshToken, organizationId);
}

export function decryptRefreshToken(sealed: string, organizationId: string): string {
    return decryptApiKey(sealed, organizationId);
}

/** Browsers drop cookies over 4096 bytes without a word; stay well under. */
export const MAX_PENDING_COOKIE_BYTES = 3800;

export async function finishCostGraphConnect(params: {
    supabase: SupabaseClient;
    organizationId: string;
    userId: string;
    tokens: TokenSet;
    subject: string | null;
    tenant: CostGraphTenant;
    clientId: string;
    fetchImpl?: typeof fetch;
}): Promise<{ connectionId: string; rowId: string }> {
    const { supabase, organizationId, tokens, tenant } = params;
    try {
        // The organization id is the BillingAccountId on every FOCUS record we send.
        const { connectionId } = await createPushConnection({
            accessToken: tokens.accessToken,
            tenantId: tenant.id,
            billingAccountId: organizationId,
            fetchImpl: params.fetchImpl,
        });

        const { data: existing } = await supabase
            .from('organization_finops_connections')
            .select('id, connection_id, sub_account')
            .eq('organization_id', organizationId)
            .eq('provider', 'costgraph')
            .maybeSingle();

        const { data, error } = await supabase
            .from('organization_finops_connections')
            .upsert({
                organization_id: organizationId,
                provider: 'costgraph',
                auth_method: 'oauth',
                connection_id: connectionId,
                costgraph_tenant_id: tenant.id,
                costgraph_tenant_name: tenant.name,
                oauth_subject: params.subject,
                ...encryptedTokenColumns(tokens, organizationId),
                oauth_refresh_lease_until: null,
                api_key_encrypted: null,
                api_key_hint: null,
                sub_account: (existing?.sub_account as string | undefined) ?? 'project',
                enabled: true,
                // A new CostGraph connection has received none of our days yet.
                ...(existing?.connection_id !== connectionId ? { last_pushed_day: null, last_closed_month: null } : {}),
                ...(existing ? {} : { created_by: params.userId }),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'organization_id,provider' })
            .select('id')
            .single();
        if (error || !data) throw new Error(`Could not save the CostGraph connection: ${error?.message ?? 'no row'}`);

        writeAuditLog({
            organizationId,
            category: 'integration',
            action: existing ? 'updated' : 'configured',
            resourceType: 'finops_connection',
            resourceId: data.id as string,
            actorId: params.userId,
            description: `Connected CostGraph with Sign in with CostGraph (tenant ${tenant.name})`,
            metadata: { connection_id: connectionId, tenant_id: tenant.id, auth_method: 'oauth' },
        });
        return { connectionId, rowId: data.id as string };
    } catch (error) {
        // Don't leave a live grant behind for a connection we didn't make.
        await revokeToken({ token: tokens.refreshToken, clientId: params.clientId, fetchImpl: params.fetchImpl });
        throw error;
    }
}
