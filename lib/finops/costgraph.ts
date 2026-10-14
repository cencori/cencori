/**
 * CostGraph API client.
 *
 * CostGraph runs two hosts. Both take the same `bl_…` key in an `X-API-Key` header:
 *   - Platform API (`api.costgraph.ai`) — FOCUS ingestion. A customer's own key, stored
 *     encrypted per organization (`focus:write`).
 *   - Pricing API (`pricing.baselinehq.cloud`, `/v1`) — the pricing catalogue, recommendations
 *     and the marketplace where Cencori publishes its rates. Cencori's own key
 *     (`COSTGRAPH_API_KEY`, `pricing:read` + `pricing:write`).
 *
 * Verified live 2026-10-14: CostGraph's FOCUS push docs show `Authorization: Bearer`, but the
 * platform answers that with 401 "API key required" and accepts `X-API-Key`.
 *
 * Errors on the Pricing API's `/v1` are RFC 9457 problem documents with a stable `code`; the
 * platform answers `{ "message", "status" }`. Both surface as `CostGraphError`.
 *
 * Docs: https://docs.costgraph.ai/api-reference/introduction
 */

export const COSTGRAPH_API_URL = (process.env.COSTGRAPH_API_URL || 'https://api.costgraph.ai').replace(/\/$/, '');
export const COSTGRAPH_PRICING_API_URL = (process.env.COSTGRAPH_PRICING_API_URL || 'https://pricing.baselinehq.cloud').replace(/\/$/, '');

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

export interface CostGraphProblem {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    code?: string;
    instance?: string;
    errors?: Array<{ pointer?: string; detail?: string }>;
    affected?: Array<{ id?: string; kind?: string; name?: string }>;
}

export class CostGraphError extends Error {
    readonly status: number;
    readonly code: string;
    readonly problem: CostGraphProblem | null;

    constructor(status: number, problem: CostGraphProblem | null, fallbackMessage: string) {
        const detail = problem?.detail || problem?.title || fallbackMessage;
        const fieldErrors = problem?.errors?.map((e) => `${e.pointer ?? ''} ${e.detail ?? ''}`.trim()).filter(Boolean);
        super(`CostGraph ${status}${problem?.code ? ` ${problem.code}` : ''}: ${detail}${fieldErrors?.length ? ` (${fieldErrors.join('; ')})` : ''}`);
        this.name = 'CostGraphError';
        this.status = status;
        this.code = problem?.code ?? `http_${status}`;
        this.problem = problem;
    }

    /** Worth retrying later without changing the request. */
    get retryable(): boolean {
        return this.status === 429 || this.status >= 500 || (this.status === 409 && this.code !== 'duplicate_price' && this.code !== 'price_in_use');
    }
}

type FetchLike = typeof fetch;

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null>;
    timeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readProblem(res: Response): Promise<CostGraphProblem | null> {
    const text = await res.text().catch(() => '');
    if (!text) return null;
    try {
        const parsed = JSON.parse(text) as CostGraphProblem & { error?: string; message?: string };
        if (parsed.detail || parsed.code) return parsed;
        // The platform answers {"message": "...", "status": "error"}; the Pricing API's deprecated
        // unprefixed routes answer {"error": "..."}.
        const detail = typeof parsed.message === 'string' ? parsed.message
            : typeof parsed.error === 'string' ? parsed.error
                : undefined;
        return detail ? { detail } : { detail: text.slice(0, 500) };
    } catch {
        return { detail: text.slice(0, 500) };
    }
}

async function request<T>(
    fetchImpl: FetchLike,
    baseUrl: string,
    headers: Record<string, string>,
    path: string,
    opts: RequestOptions = {},
): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        try {
            const res = await fetchImpl(url, {
                method: opts.method ?? 'GET',
                headers: {
                    Accept: 'application/json',
                    ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                    ...headers,
                },
                body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
                signal: controller.signal,
            });
            if (res.status === 204) return undefined as T;
            if (res.ok) {
                const text = await res.text();
                return (text ? JSON.parse(text) : undefined) as T;
            }
            const error = new CostGraphError(res.status, await readProblem(res), res.statusText || 'request failed');
            if (!error.retryable || attempt === MAX_ATTEMPTS) throw error;
            lastError = error;
            const retryAfter = Number(res.headers.get('retry-after'));
            await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 500 * 2 ** attempt);
        } catch (error) {
            if (error instanceof CostGraphError) throw error;
            lastError = error;
            if (attempt === MAX_ATTEMPTS) break;
            await sleep(500 * 2 ** attempt);
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError instanceof Error ? lastError : new Error('CostGraph request failed');
}

// ─── Platform API: FOCUS ingestion ───────────────────────────────────────────

export interface FocusPushRequest {
    connection_id: string;
    focus_version: string;
    charge_period_start: string;
    charge_period_end: string;
    rows: Array<Record<string, unknown>>;
    /** true replaces everything already ingested for the connection inside the window (as documented). */
    complete?: boolean;
    /**
     * The flag the live API actually reads for that replace (verified 2026-10-14): with only
     * `complete`, the response echoes `overwrite: false` and earlier rows survive. Sent together
     * with `complete` so the push replaces the window whichever name CostGraph settles on.
     */
    overwrite?: boolean;
    /** Required when appending; the same on every page of one export run. */
    batch_id?: string;
    /** Index of this page's first row within the whole export run. */
    row_offset?: number;
}

export interface FocusPushResponse {
    connection_id?: string;
    provider?: string;
    rows?: number;
    complete?: boolean;
    [key: string]: unknown;
}

export function createCostGraphPlatformClient(apiKey: string, fetchImpl: FetchLike = fetch) {
    const headers = { 'X-API-Key': apiKey };
    return {
        /** POST /api/v1/tenant/billing/focus — costed FOCUS records (key needs `focus:write`). */
        pushFocus(body: FocusPushRequest): Promise<FocusPushResponse> {
            return request(fetchImpl, COSTGRAPH_API_URL, headers, '/api/v1/tenant/billing/focus', {
                method: 'POST',
                body,
                timeoutMs: 120_000,
            });
        },
    };
}

// ─── Pricing API ─────────────────────────────────────────────────────────────

export type TokenBucket = 'input' | 'output' | 'cache_read' | 'cache_write';

export interface ModelPrice {
    id?: string;
    model: string;
    model_id?: string;
    provider?: string;
    publisher?: string;
    host?: string;
    region?: string;
    token_bucket: TokenBucket;
    unit_price_per_mtok: number;
    currency?: string;
    context_limit?: number;
    output_limit?: number;
    modalities_input?: string[];
    modalities_output?: string[];
    open_weights?: boolean;
    reasoning?: boolean;
    tool_call?: boolean;
    structured_output?: boolean;
    effective_from?: string;
    effective_to?: string;
    source?: string;
    source_url?: string;
    tags?: Record<string, unknown>;
}

export interface ComputePrice {
    id?: string;
    provider?: string;
    service: string;
    region: string;
    availability_zone?: string;
    instance_type?: string;
    usage_type?: string;
    operating_system?: string;
    architecture?: string;
    cpu_cores: number;
    ram_gb: number;
    gpu_count?: number;
    gpu_type?: string;
    cost_per_hour?: number;
    cpu_cores_cost_per_hour?: number;
    ram_gb_cost_per_hour?: number;
    gpu_cost_per_hour?: number;
    period_billing_hours: number;
    currency?: string;
    tags?: Record<string, unknown>;
}

export interface MachineQuery {
    provider: string;
    service: string;
    region: string;
    instance_type?: string;
    usage_type?: string;
    operating_system?: string;
    availability_zone?: string;
    vm: { cpu_cores: number; ram_gb: number };
}

export interface ComputeRecommendation {
    cpu_class?: string;
    cost_per_work_unit?: number;
    work_unit?: string;
    pricing?: ComputePrice & { cost_per_hour?: number };
    savings?: { amount_per_hour?: number; amount_per_month?: number; amount_per_year?: number; percentage?: number };
}

export interface ComputeRecommendationRequest {
    instance: MachineQuery;
    usage?: { cpu_cores: number; ram_gb: number };
    predicates?: {
        providers?: string[];
        regions?: string[];
        services?: string[];
        usage_types?: string[];
        operating_systems?: string[];
        same_architecture?: boolean;
        same_continent?: boolean;
    };
    workload_class?: 'inference_single' | 'inference_multi' | 'training_distributed';
    include_metadata?: boolean;
}

interface Paged<T> {
    data?: T[];
    page?: { has_more?: boolean; next_cursor?: string };
}

export function createCostGraphPricingClient(apiKey: string, fetchImpl: FetchLike = fetch) {
    const headers = { 'X-API-Key': apiKey };
    const call = <T>(path: string, opts?: RequestOptions) =>
        request<T>(fetchImpl, COSTGRAPH_PRICING_API_URL, headers, path, opts);

    async function listAll<T>(path: string, filters: Record<string, string | undefined> = {}): Promise<T[]> {
        const out: T[] = [];
        let cursor: string | undefined;
        do {
            const page = await call<Paged<T>>(path, { query: { ...filters, limit: 500, cursor } });
            out.push(...(page?.data ?? []));
            cursor = page?.page?.has_more ? page.page.next_cursor : undefined;
        } while (cursor);
        return out;
    }

    return {
        listProviders: () => call<Record<string, unknown>>('/v1/providers'),

        /** POST /v1/pricing/compute. `persist=false` so a lookup never writes a catalogue row. */
        priceMachine: (instance: MachineQuery) =>
            call<ComputePrice>('/v1/pricing/compute', { method: 'POST', body: instance, query: { persist: false } }),

        /** POST /v1/recommendations/compute — cheapest machine per provider that fits the shape. */
        recommendCompute: (body: ComputeRecommendationRequest) =>
            call<ComputeRecommendation[]>('/v1/recommendations/compute', { method: 'POST', body, query: { persist: false } }),

        listModelPrices: (filters: { model?: string; provider?: string; region?: string; token_bucket?: TokenBucket } = {}) =>
            listAll<ModelPrice>('/v1/marketplace/models', filters),
        publishModelPrices: (entries: ModelPrice[]) =>
            call<{ data?: ModelPrice[] }>('/v1/marketplace/models', { method: 'POST', body: { entries } }),
        /** Model prices are versioned: a patch retires the row and returns the new id. */
        patchModelPrice: (id: string, patch: Partial<ModelPrice>) =>
            call<ModelPrice>(`/v1/marketplace/models/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
        deleteModelPrice: (id: string) =>
            call<void>(`/v1/marketplace/models/${encodeURIComponent(id)}`, { method: 'DELETE' }),

        listComputePrices: (filters: Record<string, string | undefined> = {}) =>
            listAll<ComputePrice>('/v1/marketplace/compute', filters),
        publishComputePrices: (entries: ComputePrice[]) =>
            call<{ data?: ComputePrice[] }>('/v1/marketplace/compute', { method: 'POST', body: { entries } }),
    };
}

export type CostGraphPricingClient = ReturnType<typeof createCostGraphPricingClient>;
export type CostGraphPlatformClient = ReturnType<typeof createCostGraphPlatformClient>;

/** Cencori's own Pricing API client, or null when no key is configured. */
export function getCencoriPricingClient(fetchImpl: FetchLike = fetch): CostGraphPricingClient | null {
    const key = process.env.COSTGRAPH_API_KEY?.trim();
    return key ? createCostGraphPricingClient(key, fetchImpl) : null;
}
