import type { createAdminClient } from '@/lib/supabaseAdmin';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { publicProviderLabel } from '@/lib/providers/branding';
import { hasStaticPricing } from '@/lib/providers/pricing';
import { resolveApiKeyModelAccess } from '@/lib/gateway/model-access';
import { getManagedProviderNames } from '@/lib/gateway/providers-setup';
import type { ModelSource, ModelUnavailableReason, UnifiedModelRow } from './types';

type Admin = ReturnType<typeof createAdminClient>;

const UNKNOWN_CREATED = 0;

function toEpochSeconds(value: unknown): number {
    const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : UNKNOWN_CREATED;
}

export interface RegistryQuery {
    provider?: string | null;
    type?: string | null;
    available?: boolean | null;
    source?: ModelSource | null;
    connectionId?: string | null;
}

interface KeyAccess {
    allowedModels: string[] | null;
    sponsoredModels: string[] | null;
}

/**
 * Shared unified model registry (ADR-002).
 * Single projection over: Cencori-managed catalog + project BYOK/custom models
 * + synced provider_connection_models + pricing + access policy + provider health.
 */
export async function buildUnifiedModelRegistry(
    supabase: Admin,
    opts: { projectId?: string | null; keyAccess?: KeyAccess | null; query?: RegistryQuery },
): Promise<{ models: UnifiedModelRow[]; providers: Array<{ id: string; name: string; supports_byok: boolean; connection_status: string; model_count: number }> }> {
    const projectId = opts.projectId ?? null;
    const keyAccess = opts.keyAccess ?? { allowedModels: null, sponsoredModels: null };
    const q = opts.query ?? {};

    const managedProviders = getManagedProviderNames();

    // Project BYOK/custom presence expands usable set.
    const byokProviders = new Set<string>();
    const customCatalog: Array<{ id: string; owned_by: string; name: string; created: number }> = [];
    const syncedByConnection = new Map<string, UnifiedModelRow[]>();
    const connectionProvider = new Map<string, string>();

    if (projectId) {
        const { data: providerKeys } = await supabase
            .from('provider_keys')
            .select('provider')
            .eq('project_id', projectId)
            .eq('is_active', true);
        for (const row of providerKeys ?? []) {
            if (row.provider) {
                managedProviders.add(row.provider);
                byokProviders.add(row.provider);
            }
        }

        // M0 public connections also contribute.
        const { data: connections } = await supabase
            .from('provider_connections')
            .select('id, provider, status')
            .eq('project_id', projectId)
            .eq('status', 'active');
        for (const c of connections ?? []) {
            connectionProvider.set(c.id as string, c.provider as string);
            byokProviders.add(c.provider as string);
            if (q.connectionId && (c.id as string) !== q.connectionId) continue;
            const { data: synced } = await supabase
                .from('provider_connection_models')
                .select('upstream_model_id, display_name, capabilities, context_window, lifecycle_status, availability_status, unavailable_reason, pricing_status, updated_at')
                .eq('provider_connection_id', c.id as string);
            const rows: UnifiedModelRow[] = (synced ?? []).map((m) => {
                const available = (m.availability_status as string) === 'available';
                return {
                    id: m.upstream_model_id as string,
                    object: 'model' as const,
                    created: toEpochSeconds(m.updated_at),
                    owned_by: c.provider as string,
                    name: (m.display_name as string) || (m.upstream_model_id as string),
                    provider: c.provider as string,
                    source: 'byok' as const,
                    connection_id: c.id as string,
                    types: (m.capabilities as string[]) ?? ['chat'],
                    context_window: (m.context_window as number) ?? 0,
                    status: ((m.lifecycle_status as string) ?? 'active') as UnifiedModelRow['status'],
                    available,
                    unavailable_reason: (m.unavailable_reason as ModelUnavailableReason | null) ?? (available ? null : 'provider_unhealthy'),
                    byok_supported: true,
                    managed_access: false,
                    pricing_status: ((m.pricing_status as string) ?? 'unknown') as UnifiedModelRow['pricing_status'],
                    pricing: null,
                };
            });
            syncedByConnection.set(c.id as string, rows);
        }

        const { data: projectCustomProviders } = await supabase
            .from('custom_providers')
            .select('id, name, created_at, custom_models(model_name, display_name, is_active, created_at)')
            .eq('project_id', projectId)
            .eq('is_active', true);
        if (Array.isArray(projectCustomProviders)) {
            const seen = new Set<string>();
            for (const provider of projectCustomProviders) {
                const tag = `custom:${provider.id}`;
                const models = ((provider.custom_models as unknown[]) ?? [])
                    .filter((m) => (m as { model_name?: string; is_active?: boolean })?.model_name && (m as { is_active?: boolean }).is_active !== false)
                    .map((m) => {
                        const mm = m as { model_name: string; display_name: string | null; created_at: string };
                        return { id: mm.model_name, owned_by: tag, name: mm.display_name || mm.model_name, created: toEpochSeconds(mm.created_at) };
                    });
                for (const m of models) {
                    if (!m.id || seen.has(m.id)) continue;
                    seen.add(m.id);
                    customCatalog.push(m);
                }
            }
        }
    }

    const { data: pricingRows } = await supabase.from('model_pricing').select('*').eq('is_active', true);
    const activePricing = (pricingRows ?? []).filter(
        (row) =>
            !(row as { pricing_expires_at?: string }).pricing_expires_at ||
            Date.parse((row as { pricing_expires_at: string }).pricing_expires_at) > Date.now() ||
            ((row as { next_input_price_per_1k_tokens?: number }).next_input_price_per_1k_tokens != null &&
                (row as { next_output_price_per_1k_tokens?: number }).next_output_price_per_1k_tokens != null),
    );
    const priced = new Map<string, { created: number; inputPerM: number; outputPerM: number }>();
    for (const row of activePricing) {
        const r = row as { provider: string; model_name: string; created_at: string; input_price_per_1k_tokens: number; output_price_per_1k_tokens: number };
        priced.set(`${r.provider}:${r.model_name}`, {
            created: toEpochSeconds(r.created_at),
            inputPerM: Number(r.input_price_per_1k_tokens ?? 0) * 1000,
            outputPerM: Number(r.output_price_per_1k_tokens ?? 0) * 1000,
        });
    }

    const models: UnifiedModelRow[] = [];

    for (const provider of SUPPORTED_PROVIDERS) {
        for (const model of provider.models) {
            const ownedBy = publicProviderLabel(provider.id, model.id);
            const access = resolveApiKeyModelAccess({
                allowedModels: keyAccess?.allowedModels ?? null,
                sponsoredModels: keyAccess?.sponsoredModels ?? null,
                provider: ownedBy,
                model: model.id,
            });
            const hasPricing = priced.has(`${ownedBy}:${model.id}`) || hasStaticPricing(ownedBy, model.id);
            const managedAvailable = managedProviders.has(ownedBy);
            const available = access.allowed && hasPricing && managedAvailable;
            let reason: ModelUnavailableReason | null = null;
            if (!available) {
                if (!access.allowed) reason = 'model_not_allowed';
                else if (!managedAvailable && !byokProviders.has(provider.id) && !byokProviders.has(ownedBy)) reason = 'provider_connection_required';
                else if (!hasPricing) reason = 'pricing_required';
                else reason = 'unsupported';
            }
            const price = priced.get(`${ownedBy}:${model.id}`);
            const types = Array.isArray(model.type) ? model.type : [model.type];
            models.push({
                id: model.id,
                object: 'model',
                created: price?.created ?? UNKNOWN_CREATED,
                owned_by: ownedBy,
                name: model.name,
                provider: provider.id,
                source: byokProviders.has(provider.id) || byokProviders.has(ownedBy) ? 'byok' : 'cencori',
                connection_id: null,
                types,
                context_window: model.contextWindow,
                status: 'active',
                available,
                unavailable_reason: reason,
                byok_supported: true,
                managed_access: managedAvailable,
                pricing_status: price ? 'priced' : hasStaticPricing(ownedBy, model.id) ? 'priced' : 'unpriced',
                pricing: price ? { input_per_million: price.inputPerM, output_per_million: price.outputPerM, currency: 'USD' } : null,
                description: model.description,
            });
        }
    }

    for (const rows of syncedByConnection.values()) {
        for (const row of rows) {
            const access = resolveApiKeyModelAccess({
                allowedModels: keyAccess?.allowedModels ?? null,
                sponsoredModels: keyAccess?.sponsoredModels ?? null,
                provider: row.provider,
                model: row.id,
            });
            models.push({ ...row, available: row.available && access.allowed, unavailable_reason: access.allowed ? row.unavailable_reason : 'model_not_allowed' });
        }
    }

    for (const m of customCatalog) {
        const access = resolveApiKeyModelAccess({
            allowedModels: keyAccess?.allowedModels ?? null,
            sponsoredModels: keyAccess?.sponsoredModels ?? null,
            provider: m.owned_by,
            model: m.id,
        });
        if (!access.allowed) continue;
        models.push({
            id: m.id,
            object: 'model',
            created: m.created,
            owned_by: m.owned_by,
            name: m.name,
            provider: m.owned_by,
            source: 'custom',
            connection_id: null,
            types: ['chat'],
            context_window: 0,
            status: 'active',
            available: true,
            unavailable_reason: null,
            byok_supported: false,
            managed_access: false,
            pricing_status: 'custom',
            pricing: null,
            description: `Custom provider model`,
        });
    }

    let filtered = models;
    if (q.provider) filtered = filtered.filter((m) => m.owned_by === q.provider || m.provider === q.provider);
    if (q.type) filtered = filtered.filter((m) => m.types.includes(q.type as string));
    if (q.available === true) filtered = filtered.filter((m) => m.available);
    if (q.source) filtered = filtered.filter((m) => m.source === q.source);
    if (q.connectionId) filtered = filtered.filter((m) => m.connection_id === q.connectionId);

    const byProvider = new Map<string, number>();
    for (const m of filtered) byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1);
    const providers = SUPPORTED_PROVIDERS.filter((p) => byProvider.has(p.id)).map((p) => ({
        id: p.id,
        name: p.name,
        supports_byok: true,
        connection_status: managedProviders.has(p.id) ? 'configured' : byokProviders.has(p.id) ? 'byok' : 'not_configured',
        model_count: byProvider.get(p.id) ?? 0,
    }));

    return { models: filtered, providers };
}
