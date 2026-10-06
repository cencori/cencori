/**
 * Data-plane split: warm the whole per-project gateway config in one fetch.
 *
 * Before this, a chat request fanned out ~8 serial Supabase REST reads
 * (network policy, security settings, custom rules, failover settings, BYOK
 * keys, embedded fallback keys, cache settings) plus a Redis REST call per
 * cached concern. Now the route calls {@link warmGatewayProjectConfig} once:
 *
 * - warm instance → per-concern memory entries are fresh → zero network.
 * - warm Redis → one packed GET → seeds memory → zero Supabase.
 * - cold → one `gateway_project_config` RPC → seeds memory + packed blob.
 *
 * Seeded shapes exactly match what each DB reader would have cached, so
 * downstream code is untouched. The warmer never throws: on any failure it
 * returns 'bypass' and the existing per-reader paths run as before.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import {
    GATEWAY_CACHE_TTLS,
    gatewayCacheKeys,
    getCachedFailoverConfig,
    getPackedGatewayConfig,
    seedLocalCacheEntry,
    setPackedGatewayConfig,
} from '@/lib/config-cache';
import { toCachedSecuritySettings } from '@/lib/safety/utils';
import {
    DEFAULT_PROJECT_NETWORK_POLICY,
    projectNetworkPolicyFromRow,
} from '@/lib/networking/project-network-policy';
import { toCacheConfig } from '@/lib/cache/prompt-cache';
import { DEFAULT_CACHE_CONFIG, type CacheConfig } from '@/lib/cache/types';
import { indexEmbeddedConnections } from '@/lib/providers/byok-store';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type GatewayProjectBundle = {
    network?: Record<string, unknown> | null;
    security?: Record<string, unknown> | null;
    custom_rules?: Array<Record<string, unknown>> | null;
    failover?: Record<string, unknown> | null;
    provider_keys?: Array<{
        provider?: unknown;
        encrypted_key?: unknown;
        key_hint?: unknown;
        is_active?: unknown;
        default_model?: unknown;
    }> | null;
    embedded_keys?: Array<Record<string, unknown>> | null;
    cache_settings?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/**
 * Seed instance-local per-concern entries from a bundle. Exported for tests.
 * Shapes mirror the corresponding DB readers one-to-one.
 */
export function seedGatewayProjectBundle(projectId: string, bundle: GatewayProjectBundle): void {
    // Network policy (local holds the raw policy; the getter wraps it).
    const networkRow = asRecord(bundle.network);
    seedLocalCacheEntry(
        gatewayCacheKeys.network(projectId),
        networkRow
            ? projectNetworkPolicyFromRow({
                  access_mode: (networkRow.access_mode as 'public' | 'restricted' | undefined) ?? 'public',
                  allowed_cidrs: Array.isArray(networkRow.allowed_cidrs)
                      ? (networkRow.allowed_cidrs as string[])
                      : null,
              })
            : DEFAULT_PROJECT_NETWORK_POLICY,
        GATEWAY_CACHE_TTLS.NETWORK_CONFIG,
    );

    // Security settings (resolved via toCachedSecuritySettings: null row =
    // lexical secure default, explicit security_enabled false = disabled).
    seedLocalCacheEntry(
        gatewayCacheKeys.security(projectId),
        toCachedSecuritySettings(asRecord(bundle.security) as {
            security_enabled?: boolean | null;
            safety_threshold?: number | null;
            filter_jailbreaks?: boolean | null;
            filter_pii?: boolean | null;
            filter_prompt_injection?: boolean | null;
        } | null | undefined),
        GATEWAY_CACHE_TTLS.SECURITY_CONFIG,
    );

    // Custom data rules (empty array is a valid hit: nothing to enforce).
    const rules = Array.isArray(bundle.custom_rules) ? bundle.custom_rules : [];
    seedLocalCacheEntry(
        gatewayCacheKeys.customRules(projectId),
        rules,
        GATEWAY_CACHE_TTLS.CUSTOM_RULES,
    );

    // Failover settings (empty object carries the same defaults as a missing row).
    seedLocalCacheEntry(
        gatewayCacheKeys.failover(projectId),
        asRecord(bundle.failover) ?? {},
        GATEWAY_CACHE_TTLS.FAILOVER_CONFIG,
    );

    // BYOK provider keys: dashboard rows win (even inactive ones, which
    // explicitly disconnect the provider); embedded fallback fills the rest —
    // the same precedence resolveProviderKeyRow implements.
    const dashboard = new Map<string, Record<string, unknown>>();
    for (const row of bundle.provider_keys ?? []) {
        if (!row || typeof row !== 'object') continue;
        const provider = String((row as Record<string, unknown>).provider ?? '').trim().toLowerCase();
        if (provider) dashboard.set(provider, row as Record<string, unknown>);
    }
    for (const [provider, row] of dashboard) {
        seedLocalCacheEntry(
            gatewayCacheKeys.provider(projectId, provider),
            {
                row: {
                    encrypted_key: row.encrypted_key,
                    is_active: row.is_active,
                    default_model: row.default_model ?? null,
                    key_hint: row.key_hint ?? null,
                },
            },
            GATEWAY_CACHE_TTLS.PROVIDER_CONFIG,
        );
    }
    try {
        const embedded = indexEmbeddedConnections(
            (bundle.embedded_keys ?? []) as Array<{
                id?: string;
                provider?: string | null;
                status?: string | null;
                base_url?: string | null;
                encrypted_key_ref?: string | null;
                key_hint?: string | null;
                created_at?: string | null;
            }>,
        );
        for (const [provider, row] of embedded) {
            // indexEmbeddedConnections returns the raw winning rows (already
            // filtered to usable: active, keyed, non-proxy).
            const encryptedKey = (row as { encrypted_key_ref?: unknown }).encrypted_key_ref;
            if (dashboard.has(provider) || typeof encryptedKey !== 'string' || !encryptedKey) continue;
            seedLocalCacheEntry(
                gatewayCacheKeys.provider(projectId, provider),
                {
                    row: {
                        encrypted_key: encryptedKey,
                        is_active: true,
                        key_hint: (row as { key_hint?: unknown }).key_hint ?? null,
                    },
                },
                GATEWAY_CACHE_TTLS.PROVIDER_CONFIG,
            );
        }
    } catch {
        // Embedded seeding is best-effort; the reader falls back to its DB path.
    }

    // Prompt-cache config.
    const cacheSettings = asRecord(bundle.cache_settings);
    const cacheConfig: CacheConfig = cacheSettings
        ? toCacheConfig(cacheSettings)
        : DEFAULT_CACHE_CONFIG;
    seedLocalCacheEntry(
        gatewayCacheKeys.cache(projectId),
        cacheConfig,
        GATEWAY_CACHE_TTLS.CACHE_CONFIG,
    );
}

export type WarmResult = 'warm' | 'refreshed' | 'bypass';

export async function warmGatewayProjectConfig(
    supabase: SupabaseAdmin,
    projectId: string,
): Promise<WarmResult> {
    try {
        if (!projectId) return 'bypass';
        // Freshness sentinel: seeded atomically with the rest of the bundle.
        const fresh = await getCachedFailoverConfig(projectId);
        if (fresh) return 'warm';

        let bundle = (await getPackedGatewayConfig(projectId)) as GatewayProjectBundle | null;
        let fromPacked = Boolean(bundle);
        if (!bundle) {
            const { data, error } = await supabase.rpc('gateway_project_config', {
                p_project_id: projectId,
            });
            if (error || !data) return 'bypass';
            bundle = data as GatewayProjectBundle;
            void setPackedGatewayConfig(projectId, bundle);
        }
        seedGatewayProjectBundle(projectId, bundle);
        return fromPacked ? 'warm' : 'refreshed';
    } catch {
        return 'bypass';
    }
}
