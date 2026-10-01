/**
 * Public catalog — models and providers.
 *
 * Keyless helpers over the public endpoints (`GET /api/models`,
 * `GET /api/providers`, `GET /api/providers/:id/logo`). No `Cencori` client
 * or API key needed, so these are safe to call from a browser bundle when
 * embedding Cencori's model/provider shelf (with logos) inside your product.
 *
 * This is the *marketing* catalog: static display pricing, no per-project
 * availability. Authenticated callers needing per-key availability, DB-backed
 * pricing and BYOK/custom rows should use `cencori.models.list()` instead.
 *
 * @example
 * ```typescript
 * import { listCatalogModels, listCatalogProviders, providerLogoUrl } from 'cencori';
 *
 * const { data: models } = await listCatalogModels({ provider: 'openai' });
 * const { data: providers } = await listCatalogProviders();
 * const logo = providerLogoUrl('openai'); // https://cencori.com/api/providers/openai/logo
 * ```
 */

export const DEFAULT_CATALOG_BASE_URL = 'https://cencori.com';

export interface CatalogModelPricing {
    input_per_million: number | null;
    output_per_million: number | null;
    currency: 'USD';
    input_display: string;
    output_display: string;
    per_image: boolean;
    per_image_usd: number | null;
}

export interface CatalogModel {
    id: string;
    object: 'model';
    name: string;
    provider: string;
    provider_name: string;
    /** Absolute logo URL — safe to use as an <img> src directly. */
    provider_logo_url: string;
    owned_by: string;
    type: string;
    types: string[];
    context_window: number;
    context_display: string;
    description?: string;
    capabilities?: Record<string, boolean>;
    pricing: CatalogModelPricing;
    added_at: string | null;
    created: number;
}

export interface CatalogProvider {
    id: string;
    name: string;
    /** Relative static icon path (may not exist for every vendor). */
    icon: string;
    /** Absolute icon URL. Falls back to `logo_url` when no static file exists. */
    icon_url: string;
    /** Absolute logo URL — always returns an SVG. Prefer this for embedding. */
    logo_url: string;
    website: string;
    docs_url: string;
    model_count: number;
}

export interface CatalogModelsResponse {
    object: 'list';
    data: CatalogModel[];
    providers: CatalogProvider[];
    total: number;
    distinct_model_ids: number;
    updated_at: string;
}

export interface CatalogProvidersResponse {
    object: 'list';
    data: CatalogProvider[];
    total: number;
    updated_at: string;
}

export interface CatalogModelFilters {
    /** Provider id, e.g. 'openai' (case-insensitive). */
    provider?: string;
    /** Model type: chat, reasoning, code, search, vision, image. */
    type?: string;
    /** Substring match on name, id, provider, description. */
    search?: string;
    /**
     * Capability filter — a model must carry every one listed:
     * reasoning, vision, code, search, image, tools, structuredOutput,
     * fileInput, videoInput, audioInput, caching.
     */
    capability?: string | string[];
}

export interface CatalogRequestOptions {
    /** Catalog host (default: https://cencori.com). */
    baseUrl?: string;
    signal?: AbortSignal;
}

function baseUrlOf(options?: CatalogRequestOptions): string {
    return (options?.baseUrl ?? DEFAULT_CATALOG_BASE_URL).replace(/\/$/, '');
}

function modelQuery(filters?: CatalogModelFilters): string {
    const search = new URLSearchParams();
    if (filters?.provider) search.set('provider', filters.provider);
    if (filters?.type) search.set('type', filters.type);
    if (filters?.search) search.set('search', filters.search);
    const caps = filters?.capability
        ? (Array.isArray(filters.capability) ? filters.capability : [filters.capability])
        : [];
    for (const cap of caps) search.append('capability', cap);
    const s = search.toString();
    return s ? `?${s}` : '';
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Catalog request failed (${response.status} ${url})${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    return response.json() as Promise<T>;
}

/**
 * List the public model catalog — the same data rendered on
 * https://cencori.com/ai-gateway/models. No API key required.
 */
export function listCatalogModels(
    filters?: CatalogModelFilters,
    options?: CatalogRequestOptions,
): Promise<CatalogModelsResponse> {
    return getJson<CatalogModelsResponse>(
        `${baseUrlOf(options)}/api/models${modelQuery(filters)}`,
        options?.signal,
    );
}

/** List providers with logo URLs and model counts. No API key required. */
export function listCatalogProviders(
    options?: CatalogRequestOptions,
): Promise<CatalogProvidersResponse> {
    return getJson<CatalogProvidersResponse>(
        `${baseUrlOf(options)}/api/providers`,
        options?.signal,
    );
}

/**
 * Absolute URL of a provider's logo (SVG). Always resolves for known
 * providers — serve it straight into an `<img>` tag. No fetch needed.
 *
 * NOTE: several brand marks are white (OpenAI, Anthropic) — render them on
 * a dark chip.
 */
export function providerLogoUrl(providerId: string, baseUrl: string = DEFAULT_CATALOG_BASE_URL): string {
    return `${baseUrl.replace(/\/$/, '')}/api/providers/${encodeURIComponent(providerId)}/logo`;
}
