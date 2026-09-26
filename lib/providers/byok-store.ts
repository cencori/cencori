/**
 * Unified BYOK key store.
 *
 * Two tables grew up holding the same official-vendor keys:
 * - `provider_keys` — dashboard console (user-session auth, one row per
 *   provider, default-model columns). Every gateway reader uses this.
 * - `provider_connections` — embedded API (secret-key auth, named rows,
 *   custom proxies, test/sync lifecycle). The M0 schema calls it "unified
 *   over legacy", but nothing ever unified them: an API-added key returned
 *   201 yet never powered agents and never appeared on the dashboard.
 *
 * This module is the single seam. Reads resolve dashboard-first with an
 * embedded fallback; writes mirror official managed-endpoint keys in both
 * directions so the two tables stay in agreement. Proxy-bound connections
 * (`base_url` set) are a genuinely different concept and stay embedded-only.
 */

import { decryptApiKey } from '@/lib/encryption';

export interface EmbeddedConnectionRow {
    id?: string;
    provider?: string | null;
    status?: string | null;
    base_url?: string | null;
    encrypted_key_ref?: string | null;
    key_hint?: string | null;
    created_at?: string | null;
}

/**
 * Vendors whose keys may live in `provider_keys` (its CHECK constraint).
 * `openrouter` is dashboard-only legacy with no embedded counterpart.
 */
const MIRRORABLE_PROVIDERS = new Set([
    'openai', 'anthropic', 'google', 'mistral', 'groq', 'cohere',
    'together', 'perplexity', 'xai', 'meta', 'huggingface', 'qwen', 'deepseek',
]);

export function canMirrorProvider(provider: string): boolean {
    return MIRRORABLE_PROVIDERS.has(provider.trim().toLowerCase());
}

/** Latest usable row wins; keyless, inactive, or proxy-bound rows lose. */
export function pickEmbeddedFallbackRow<T extends EmbeddedConnectionRow>(rows: T[]): T | null {
    const usable = (rows ?? []).filter(
        (r) =>
            r &&
            r.encrypted_key_ref &&
            (r.status ?? 'active') === 'active' &&
            (r.base_url ?? null) === null,
    );
    if (usable.length === 0) return null;
    usable.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    return usable[0];
}

/** Newest usable connection per provider (providers already lowercased). */
export function indexEmbeddedConnections<T extends EmbeddedConnectionRow>(rows: T[]): Map<string, T> {
    const byProvider = new Map<string, T[]>();
    for (const row of rows ?? []) {
        const provider = String(row?.provider ?? '').trim().toLowerCase();
        if (!provider) continue;
        const list = byProvider.get(provider) ?? [];
        list.push(row);
        byProvider.set(provider, list);
    }
    const latest = new Map<string, T>();
    for (const [provider, list] of byProvider) {
        const winner = pickEmbeddedFallbackRow(list);
        if (winner) latest.set(provider, winner);
    }
    return latest;
}

export interface EmbeddedFallbackKey {
    encryptedKeyRef: string;
    keyHint: string | null;
    connectionId: string | null;
}

// Loose structural type for the admin client so unit tests can pass mocks.
type AdminQuery = {
    from: (table: string) => any;
};

/**
 * Newest usable embedded key for a provider. Null when nothing usable —
 * never throws (callers fall through to managed).
 */
export async function fetchEmbeddedFallbackKey(
    supabase: AdminQuery,
    projectId: string,
    provider: string,
): Promise<EmbeddedFallbackKey | null> {
    try {
        const target = provider.trim().toLowerCase();
        if (!target) return null;
        const { data, error } = await supabase
            .from('provider_connections')
            .select('id, provider, status, base_url, encrypted_key_ref, key_hint, created_at')
            .eq('project_id', projectId)
            .eq('provider', target)
            .order('created_at', { ascending: false })
            .limit(5);
        if (error || !data) return null;
        const winner = pickEmbeddedFallbackRow(data as EmbeddedConnectionRow[]);
        if (!winner?.encrypted_key_ref) return null;
        return {
            encryptedKeyRef: winner.encrypted_key_ref,
            keyHint: winner.key_hint ?? null,
            connectionId: (winner.id as string | undefined) ?? null,
        };
    } catch {
        return null;
    }
}

export interface ResolvedProviderKeyRow {
    row: { encrypted_key: string; is_active: boolean; default_model?: string | null; key_hint?: string | null };
    source: 'dashboard' | 'api';
}

/**
 * Single row-level read path for official-vendor keys: dashboard row first
 * (it owns default models and is what long-lived projects already use),
 * newest usable embedded connection as fallback. Used by the gateway, which
 * caches the encrypted row and decrypts after the cache read.
 */
export async function resolveProviderKeyRow(
    supabase: AdminQuery,
    opts: { projectId: string; provider: string },
): Promise<ResolvedProviderKeyRow | null> {
    const target = opts.provider.trim().toLowerCase();
    if (!target) return null;
    try {
        const { data, error } = await supabase
            .from('provider_keys')
            .select('encrypted_key, key_hint, is_active, default_model')
            .eq('project_id', opts.projectId)
            .eq('provider', target)
            .maybeSingle();
        if (!error && data && (data as { is_active?: boolean }).is_active) {
            return {
                row: data as ResolvedProviderKeyRow['row'],
                source: 'dashboard',
            };
        }
        if (!error && data) {
            // Dashboard row exists but is disabled: explicit disconnect wins
            // over any embedded row. Mirrors keep the stores in agreement, so
            // this mainly covers pre-unification leftovers.
            return null;
        }
    } catch {
        // Dashboard lookup failure falls through to embedded below.
    }
    const fallback = await fetchEmbeddedFallbackKey(supabase, opts.projectId, target);
    if (!fallback) return null;
    return {
        row: { encrypted_key: fallback.encryptedKeyRef, is_active: true, key_hint: fallback.keyHint },
        source: 'api',
    };
}

export interface ResolvedProviderKey {
    apiKey: string;
    source: 'dashboard' | 'api';
    keyHint: string | null;
    defaultModel?: string;
}

/**
 * Decrypting convenience over {@link resolveProviderKeyRow} for non-gateway
 * readers. Never throws — null means "no BYOK, use managed".
 */
export async function resolveProviderKey(
    supabase: AdminQuery,
    opts: { projectId: string; organizationId: string; provider: string },
): Promise<ResolvedProviderKey | null> {
    const resolved = await resolveProviderKeyRow(supabase, {
        projectId: opts.projectId,
        provider: opts.provider,
    });
    if (!resolved) return null;
    try {
        const apiKey = decryptApiKey(resolved.row.encrypted_key, opts.organizationId);
        return {
            apiKey,
            source: resolved.source,
            keyHint: resolved.row.key_hint ?? null,
            defaultModel: resolved.row.default_model || undefined,
        };
    } catch {
        return null;
    }
}

/**
 * After an embedded write: mirror the newest usable managed connection into
 * `provider_keys` (upsert), or remove the mirrored row when nothing usable
 * remains. Never throws — divergence is preferable to failing the write.
 */
export async function mirrorConnectionsToKeys(
    supabase: AdminQuery,
    opts: { projectId: string; organizationId: string; provider: string },
): Promise<void> {
    const target = opts.provider.trim().toLowerCase();
    if (!canMirrorProvider(target)) return;
    try {
        const { data } = await supabase
            .from('provider_connections')
            .select('encrypted_key_ref, key_hint, created_at')
            .eq('project_id', opts.projectId)
            .eq('provider', target)
            .eq('status', 'active')
            .is('base_url', null)
            .not('encrypted_key_ref', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);
        const winner = pickEmbeddedFallbackRow(
            ((data ?? []) as EmbeddedConnectionRow[]).map((r) => ({ ...r, status: 'active' as const })),
        );
        if (!winner?.encrypted_key_ref) {
            await supabase.from('provider_keys').delete().eq('project_id', opts.projectId).eq('provider', target);
            return;
        }
        // Same ciphertext works verbatim: both tables encrypt with the
        // organization key. Only key columns are upserted so per-provider
        // default models configured on the dashboard survive rotation.
        await supabase.from('provider_keys').upsert(
            {
                project_id: opts.projectId,
                provider: target,
                encrypted_key: winner.encrypted_key_ref,
                key_hint: winner.key_hint ?? null,
                is_active: true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'project_id,provider' },
        );
    } catch (e) {
        console.warn('[BYOK] mirror connections->keys failed:', e);
    }
}

/**
 * After a dashboard write: mirror the dashboard key into the primary
 * embedded connection (update newest in place, else insert), or disable
 * embedded rows when the dashboard key is gone/inactive. Never throws.
 */
export async function mirrorKeysToConnections(
    supabase: AdminQuery,
    opts: { projectId: string; organizationId: string; provider: string; displayName: string },
): Promise<void> {
    const target = opts.provider.trim().toLowerCase();
    if (!canMirrorProvider(target)) return;
    try {
        const { data: keyRow } = await supabase
            .from('provider_keys')
            .select('encrypted_key, key_hint, is_active')
            .eq('project_id', opts.projectId)
            .eq('provider', target)
            .maybeSingle();
        const activeKey =
            keyRow && (keyRow as { is_active?: boolean }).is_active
                ? (keyRow as { encrypted_key: string; key_hint?: string | null })
                : null;

        const { data: rows } = await supabase
            .from('provider_connections')
            .select('id, status, base_url, encrypted_key_ref, created_at')
            .eq('project_id', opts.projectId)
            .eq('provider', target)
            .order('created_at', { ascending: false })
            .limit(10);
        const managed = ((rows ?? []) as EmbeddedConnectionRow[]).filter(
            (r) => (r.base_url ?? null) === null,
        );

        if (!activeKey?.encrypted_key) {
            // Dashboard key removed/disabled: stand down managed connections
            // (proxy rows are untouched). History/syncs are preserved.
            const ids = managed
                .filter((r) => r.status === 'active' && r.id)
                .map((r) => r.id as string);
            if (ids.length > 0) {
                await supabase.from('provider_connections').update({ status: 'disabled' }).in('id', ids);
            }
            return;
        }

        const primary = pickEmbeddedFallbackRow(managed);
        if (primary?.id) {
            await supabase
                .from('provider_connections')
                .update({
                    encrypted_key_ref: activeKey.encrypted_key,
                    key_hint: activeKey.key_hint ?? null,
                    status: 'active',
                })
                .eq('id', primary.id);
            return;
        }
        await supabase.from('provider_connections').insert({
            project_id: opts.projectId,
            name: opts.displayName || target,
            provider: target,
            api_format: target === 'anthropic' ? 'anthropic' : 'openai',
            base_url: null,
            encrypted_key_ref: activeKey.encrypted_key,
            key_hint: activeKey.key_hint ?? null,
            status: 'active',
        });
    } catch (e) {
        console.warn('[BYOK] mirror keys->connections failed:', e);
    }
}
