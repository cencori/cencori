/**
 * Bridge between the embedded connection plane (`provider_connections`,
 * written via `/v1/provider-connections`) and the gateway BYOK runtime
 * (which historically only reads `provider_keys`).
 *
 * Without this, a key added over the API reports success yet never powers
 * agents and never appears on the dashboard — the exact confusion that
 * prompted it. The fallback is deliberately narrow:
 *
 * - Same project, same provider (lowercased on both sides).
 * - Only `status = 'active'` rows holding a key (`encrypted_key_ref`).
 * - Only managed-endpoint rows (`base_url IS NULL`). A row pointing at a
 *   custom proxy must not be presented as the vendor's own key.
 * - Latest `created_at` wins when duplicates exist (POST creates a new row
 *   per call, it never upserts).
 */

export interface EmbeddedConnectionRow {
    id?: string;
    provider?: string | null;
    status?: string | null;
    base_url?: string | null;
    encrypted_key_ref?: string | null;
    key_hint?: string | null;
    created_at?: string | null;
}

/** Latest usable row wins; anything without a key, inactive, or proxy-bound loses. */
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

/**
 * Load the newest usable embedded key for a provider. Returns null when
 * there is nothing usable — never throws (callers fall through to managed).
 */
export async function fetchEmbeddedFallbackKey(
    supabase: {
        from: (table: string) => {
            select: (cols: string) => {
                eq: (col: string, val: string) => {
                    eq: (col: string, val: string) => {
                        order: (col: string, opts: { ascending: boolean }) => {
                            limit: (n: number) => PromiseLike<{ data: EmbeddedConnectionRow[] | null; error: unknown }>;
                        };
                    };
                };
            };
        };
    },
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
        const winner = pickEmbeddedFallbackRow(data);
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
