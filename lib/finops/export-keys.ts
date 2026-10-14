/**
 * Organization usage export keys (`cuk_…`).
 *
 * Project keys are the wrong credential for a FinOps tool: each one sees a single project, and
 * each one can call models and spend money. An export key sees every project in its organization
 * and can do exactly one thing — read usage. It is never accepted by the gateway (it is not in
 * `api_keys`), so a leaked export key cannot run up a bill.
 *
 * Only the SHA-256 hash is stored; the plaintext is shown once, at creation.
 */

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashApiKey } from '@/lib/api-keys';

export const EXPORT_KEY_PREFIX = 'cuk_';
const EXPORT_KEY_PATTERN = /^cuk_[a-f0-9]{48}$/;
export const EXPORT_KEY_SCOPE_USAGE_READ = 'usage:read';

export function isExportKey(token: string | null | undefined): token is string {
    return typeof token === 'string' && token.startsWith(EXPORT_KEY_PREFIX);
}

export function generateExportKey(): string {
    return `${EXPORT_KEY_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

export interface ExportKeySummary {
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
}

export async function createExportKey(
    supabase: SupabaseClient,
    params: { organizationId: string; name: string; createdBy: string | null },
): Promise<{ key: string; summary: ExportKeySummary }> {
    const key = generateExportKey();
    const { data, error } = await supabase
        .from('organization_usage_export_keys')
        .insert({
            organization_id: params.organizationId,
            name: params.name,
            key_prefix: `${key.slice(0, 8)}…${key.slice(-4)}`,
            key_hash: hashApiKey(key),
            scopes: [EXPORT_KEY_SCOPE_USAGE_READ],
            created_by: params.createdBy,
        })
        .select('id, name, key_prefix, scopes, created_at, last_used_at')
        .single();
    if (error || !data) throw new Error(`Could not create export key: ${error?.message ?? 'no row'}`);
    return { key, summary: data as ExportKeySummary };
}

export async function listExportKeys(
    supabase: SupabaseClient,
    organizationId: string,
): Promise<ExportKeySummary[]> {
    const { data, error } = await supabase
        .from('organization_usage_export_keys')
        .select('id, name, key_prefix, scopes, created_at, last_used_at')
        .eq('organization_id', organizationId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not list export keys: ${error.message}`);
    return (data ?? []) as ExportKeySummary[];
}

export async function revokeExportKey(
    supabase: SupabaseClient,
    params: { organizationId: string; keyId: string },
): Promise<void> {
    const { error } = await supabase
        .from('organization_usage_export_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', params.keyId)
        .eq('organization_id', params.organizationId)
        .is('revoked_at', null);
    if (error) throw new Error(`Could not revoke export key: ${error.message}`);
}

/**
 * Resolve an export key to its organization, or null when it is unknown, revoked, malformed or
 * lacks `scope`. Records the use, best-effort.
 */
export async function verifyExportKey(
    supabase: SupabaseClient,
    key: string,
    scope: string = EXPORT_KEY_SCOPE_USAGE_READ,
): Promise<{ organizationId: string; keyId: string } | null> {
    if (!EXPORT_KEY_PATTERN.test(key)) return null;
    const { data, error } = await supabase
        .from('organization_usage_export_keys')
        .select('id, organization_id, scopes, revoked_at')
        .eq('key_hash', hashApiKey(key))
        .maybeSingle();
    if (error || !data || data.revoked_at) return null;
    if (!((data.scopes as string[] | null) ?? []).includes(scope)) return null;

    void supabase
        .from('organization_usage_export_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(() => undefined, () => undefined);

    return { organizationId: data.organization_id as string, keyId: data.id as string };
}
