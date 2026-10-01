import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { publicProviderDisplayName, publicProviderLabel } from '@/lib/providers/branding';
import { formatContextWindow, getModelDisplayPrice } from '@/lib/providers/display-pricing';

export interface PublicCatalogModel {
    id: string;
    object: 'model';
    name: string;
    provider: string;
    provider_name: string;
    /** Absolute URL to GET /api/providers/:id/logo — safe to <img> directly. */
    provider_logo_url: string;
    owned_by: string;
    type: string;
    types: string[];
    context_window: number;
    context_display: string;
    description: string | undefined;
    capabilities: Record<string, boolean> | undefined;
    pricing: {
        input_per_million: number | null;
        output_per_million: number | null;
        currency: 'USD';
        input_display: string;
        output_display: string;
        per_image: boolean;
        per_image_usd: number | null;
    };
    added_at: string | null;
    created: number;
}

export interface PublicCatalogProvider {
    id: string;
    name: string;
    icon: string;
    /** Absolute URL to the static icon file (may 404 for vendors without a checked-in SVG). */
    icon_url: string;
    /** Absolute URL to GET /api/providers/:id/logo — always returns an SVG (never 404s). Use this for embedding. */
    logo_url: string;
    website: string;
    docs_url: string;
    model_count: number;
}

function toEpochSeconds(addedAt: string | undefined): number {
    if (!addedAt) return 0;
    const parsed = Date.parse(addedAt);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

function modelTypes(type: string | string[]): string[] {
    return Array.isArray(type) ? type : [type];
}

/** Full public catalog in the marketing page's default order (addedAt desc). */
export function buildPublicCatalog(baseUrl?: string): {
    models: PublicCatalogModel[];
    providers: PublicCatalogProvider[];
} {
    const models: PublicCatalogModel[] = [];
    const catalogBase = (baseUrl ?? 'https://cencori.com').replace(/\/$/, '');

    for (const provider of SUPPORTED_PROVIDERS) {
        for (const model of provider.models) {
            const types = modelTypes(model.type);
            const displayPrice = getModelDisplayPrice(model.id, model.type);
            const providerId = publicProviderLabel(provider.id, model.id);
            const providerName = publicProviderDisplayName(provider.id, provider.name, model.id);
            models.push({
                id: model.id,
                object: 'model',
                name: model.name,
                provider: providerId,
                provider_name: providerName,
                provider_logo_url: `${catalogBase}/api/providers/${encodeURIComponent(providerId)}/logo`,
                owned_by: providerId,
                type: types[0] ?? 'chat',
                types,
                context_window: model.contextWindow,
                context_display: formatContextWindow(model.contextWindow),
                description: model.description,
                capabilities: model.capabilities as Record<string, boolean> | undefined,
                pricing: {
                    input_per_million: displayPrice.inputPerMillion,
                    output_per_million: displayPrice.outputPerMillion,
                    currency: 'USD',
                    input_display: displayPrice.input,
                    output_display: displayPrice.output,
                    per_image: displayPrice.perImage,
                    per_image_usd: displayPrice.perImageUsd,
                },
                added_at: model.addedAt ?? null,
                created: toEpochSeconds(model.addedAt),
            });
        }
    }

    // Same default order as ModelCatalog: newest addedAt first, name tiebreak.
    models.sort(
        (a, b) =>
            (b.added_at ?? '').localeCompare(a.added_at ?? '') || a.name.localeCompare(b.name),
    );

    const counts = new Map<string, number>();
    for (const m of models) counts.set(m.provider, (counts.get(m.provider) ?? 0) + 1);

    const byId = new Map(SUPPORTED_PROVIDERS.map((p) => [p.id, p]));
    const base = catalogBase;
    // Ids with a checked-in SVG under /public/providers (or /partners for
    // maximo). Every other vendor's `icon` path 404s — point `icon_url` at
    // the logo endpoint instead so hotlinking it never breaks.
    const STATIC_ICON_IDS = new Set(['openai', 'anthropic', 'google', 'helix', 'maximo', 'centaur', 'voice', 'cencori']);
    const providers: PublicCatalogProvider[] = [...counts.entries()].map(([id, model_count]) => {
        const p = byId.get(id);
        const icon = id === 'cencori' ? '/logo%20black.svg' : (p?.icon ?? '');
        const logo_url = `${base}/api/providers/${encodeURIComponent(id)}/logo`;
        return {
            id,
            name: id === 'cencori' ? 'Cencori' : (p?.name ?? id),
            icon,
            icon_url: icon && STATIC_ICON_IDS.has(id) ? `${base}${icon}` : logo_url,
            logo_url,
            website: p?.website ?? '',
            docs_url: p?.docsUrl ?? '',
            model_count,
        };
    });
    providers.sort((a, b) => a.name.localeCompare(b.name));

    return { models, providers };
}

const CAPABILITY_MATCHERS: Record<string, (m: PublicCatalogModel) => boolean> = {
    reasoning: (m) => m.types.includes('reasoning'),
    vision: (m) => m.types.includes('vision'),
    code: (m) => m.types.includes('code'),
    search: (m) => m.types.includes('search'),
    image: (m) => m.types.includes('image'),
    tools: (m) => m.capabilities?.tools === true,
    structuredOutput: (m) => m.capabilities?.structuredOutput === true,
    fileInput: (m) => m.capabilities?.fileInput === true,
    videoInput: (m) => m.capabilities?.videoInput === true,
    audioInput: (m) => m.capabilities?.audioInput === true,
    caching: (m) => m.capabilities?.caching === true,
};

export function filterPublicCatalog(
    catalog: { models: PublicCatalogModel[]; providers: PublicCatalogProvider[] },
    opts: { provider?: string | null; type?: string | null; search?: string | null; capabilities?: string[] },
): typeof catalog {
    let models = catalog.models;

    if (opts.provider) {
        const p = opts.provider.toLowerCase();
        models = models.filter((m) => m.provider.toLowerCase() === p || m.owned_by.toLowerCase() === p);
    }
    if (opts.type) {
        const t = opts.type.toLowerCase();
        models = models.filter((m) => m.types.some((x) => x.toLowerCase() === t));
    }
    if (opts.capabilities && opts.capabilities.length > 0) {
        models = models.filter((m) =>
            opts.capabilities!.every((c) => CAPABILITY_MATCHERS[c]?.(m) ?? false),
        );
    }
    if (opts.search) {
        const q = opts.search.toLowerCase();
        models = models.filter(
            (m) =>
                m.name.toLowerCase().includes(q) ||
                m.id.toLowerCase().includes(q) ||
                m.provider_name.toLowerCase().includes(q) ||
                m.description?.toLowerCase().includes(q),
        );
    }

    const counts = new Map<string, number>();
    for (const m of models) counts.set(m.provider, (counts.get(m.provider) ?? 0) + 1);
    const providers = catalog.providers
        .filter((p) => counts.has(p.id))
        .map((p) => ({ ...p, model_count: counts.get(p.id) ?? 0 }));

    return { models, providers };
}
