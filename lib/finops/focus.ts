/**
 * Cencori usage as FOCUS 1.2 records.
 *
 * FOCUS (https://focus.finops.org) is the FinOps Foundation's billing-data spec. Exporting in it
 * means any FinOps tool — CostGraph, and anything else that reads FOCUS — can put Cencori spend
 * beside the rest of a company's cloud bill without a Cencori-specific connector.
 *
 * Grain: one record per UTC day × project × environment × upstream provider × model × endpoint
 * family × sub-account, rolled up in SQL by `focus_usage_daily()`.
 *
 * What the cost columns mean here:
 *   - BilledCost / EffectiveCost / ListCost / ContractedCost are what Cencori charges for the
 *     usage (`cencori_charge_usd`). Cencori adds no markup, so they are equal.
 *   - BYOK usage is billed by the customer's own provider account, not by Cencori, so it carries
 *     a cost of zero here. A FinOps tool that also reads that provider bill would otherwise count
 *     it twice. What the provider charged is still visible as `x_UpstreamProviderCost`.
 *
 * Costs and quantities are decimal strings, as FOCUS-over-JSON consumers expect (CostGraph rejects
 * numbers to avoid losing precision).
 */

export const FOCUS_VERSION = '1.2';

export type SubAccountMode = 'project' | 'end_user' | 'tenant' | 'none';
export const SUB_ACCOUNT_MODES: readonly SubAccountMode[] = ['project', 'end_user', 'tenant', 'none'];

export function isSubAccountMode(value: unknown): value is SubAccountMode {
    return typeof value === 'string' && (SUB_ACCOUNT_MODES as readonly string[]).includes(value);
}

/** One row of `focus_usage_daily()` output. Numeric aggregates may arrive as strings. */
export interface UsageRollupRow {
    day: string;
    project_id: string;
    project_name: string | null;
    environment: string;
    provider: string;
    model: string;
    endpoint_family: string;
    sub_account_id: string | null;
    requests: number | string;
    prompt_tokens: number | string;
    completion_tokens: number | string;
    total_tokens: number | string;
    cache_read_tokens: number | string | null;
    cache_write_tokens: number | string | null;
    uncached_prompt_tokens: number | string | null;
    unsplit_requests: number | string;
    charge_usd: number | string;
    provider_cost_usd: number | string;
}

export interface FocusContext {
    organizationId: string;
    organizationName: string;
    subAccount: SubAccountMode;
}

export type FocusRecord = Record<string, string | number | Record<string, string> | undefined>;

/** The Provider / ServiceProvider every record carries; a push connection is bound to it. */
export const FOCUS_PROVIDER_NAME = 'Cencori';
const SERVICE_NAME = 'Cencori AI Gateway';

const SUB_ACCOUNT_TYPES: Record<Exclude<SubAccountMode, 'none'>, string> = {
    project: 'Project',
    end_user: 'End User',
    tenant: 'Tenant',
};

const ENDPOINT_LABELS: Record<string, string> = {
    chat: 'chat',
    embeddings: 'embeddings',
    images: 'image generation',
    audio: 'audio',
    vision: 'vision',
    documents: 'documents',
    moderation: 'moderation',
    web: 'web',
};

function toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function integerString(value: number | string | null | undefined): string {
    return String(Math.max(0, Math.round(toNumber(value))));
}

/**
 * USD as a decimal string with no float artefacts. Ten places keeps sub-cent token charges
 * (a single cached token can cost 1e-8 USD) without inventing precision we never had.
 */
export function usdString(value: number | string | null | undefined): string {
    const fixed = toNumber(value).toFixed(10);
    const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
    return trimmed === '-0' ? '0' : trimmed;
}

/** [start, end) of the UTC calendar month containing `day` (YYYY-MM-DD). */
export function billingPeriodFor(day: string): { start: string; end: string } {
    const [year, month] = day.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start: start.toISOString(), end: end.toISOString() };
}

export function dayBounds(day: string): { start: string; end: string } {
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86_400_000);
    return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Map one rollup row to a FOCUS 1.2 record.
 *
 * Quantity is tokens when the usage was tokenised, otherwise requests (image generation and some
 * audio endpoints bill per call). The token buckets ride along as `x_` extension columns, which
 * FOCUS reserves for provider-specific data, so a consumer that prices per bucket can.
 */
export function toFocusRecord(row: UsageRollupRow, ctx: FocusContext): FocusRecord {
    const totalTokens = toNumber(row.total_tokens);
    const requests = toNumber(row.requests);
    const billingPeriod = billingPeriodFor(row.day);
    const chargePeriod = dayBounds(row.day);
    const skuId = `${row.provider}/${row.model}`;
    const family = row.endpoint_family || 'chat';
    const quantityIsTokens = totalTokens > 0;
    const charge = usdString(row.charge_usd);

    const record: FocusRecord = {
        BillingAccountId: ctx.organizationId,
        BillingAccountName: ctx.organizationName,
        BillingAccountType: 'Organization',
        BillingCurrency: 'USD',
        BillingPeriodStart: billingPeriod.start,
        BillingPeriodEnd: billingPeriod.end,
        ChargePeriodStart: chargePeriod.start,
        ChargePeriodEnd: chargePeriod.end,
        ChargeCategory: 'Usage',
        ChargeFrequency: 'Usage-Based',
        ChargeDescription: `${skuId} ${ENDPOINT_LABELS[family] ?? family} (${integerString(requests)} requests)`,
        Provider: FOCUS_PROVIDER_NAME,
        ProviderName: FOCUS_PROVIDER_NAME,
        ServiceProviderName: FOCUS_PROVIDER_NAME,
        InvoiceIssuer: FOCUS_PROVIDER_NAME,
        InvoiceIssuerName: FOCUS_PROVIDER_NAME,
        // The model's maker, which is who actually produced what was consumed.
        Publisher: row.provider,
        PublisherName: row.provider,
        ServiceName: SERVICE_NAME,
        ServiceCategory: 'AI and Machine Learning',
        ServiceSubcategory: 'Generative AI',
        ResourceId: row.project_id,
        ResourceName: row.project_name ?? row.project_id,
        ResourceType: 'Project',
        SkuId: skuId,
        SkuMeter: quantityIsTokens ? `${family}/tokens` : `${family}/requests`,
        ConsumedQuantity: quantityIsTokens ? integerString(totalTokens) : integerString(requests),
        ConsumedUnit: quantityIsTokens ? 'Tokens' : 'Requests',
        PricingCategory: 'Standard',
        BilledCost: charge,
        EffectiveCost: charge,
        ListCost: charge,
        ContractedCost: charge,
        Tags: {
            'cencori:project': row.project_id,
            'cencori:environment': row.environment,
            'cencori:endpoint': family,
        },
        x_RequestCount: integerString(requests),
        x_InputTokens: integerString(row.uncached_prompt_tokens),
        x_CacheReadTokens: integerString(row.cache_read_tokens),
        x_CacheWriteTokens: integerString(row.cache_write_tokens),
        x_OutputTokens: integerString(row.completion_tokens),
        x_PromptTokens: integerString(row.prompt_tokens),
        // Requests whose input/cache split is unknown (older rows, providers that report cache
        // activity without the uncached count). Non-zero means the bucket columns undercount.
        x_UnsplitRequests: integerString(row.unsplit_requests),
        x_UpstreamProviderCost: usdString(row.provider_cost_usd),
    };

    if (ctx.subAccount !== 'none' && row.sub_account_id) {
        record.SubAccountId = row.sub_account_id;
        record.SubAccountType = SUB_ACCOUNT_TYPES[ctx.subAccount];
        if (ctx.subAccount === 'project') {
            record.SubAccountName = row.project_name ?? row.project_id;
        }
    }

    return record;
}

const CSV_COLUMNS = [
    'BillingAccountId', 'BillingAccountName', 'BillingCurrency', 'BillingPeriodStart', 'BillingPeriodEnd',
    'ChargePeriodStart', 'ChargePeriodEnd', 'ChargeCategory', 'ChargeDescription', 'Provider', 'Publisher',
    'ServiceName', 'ServiceCategory', 'ServiceSubcategory', 'SubAccountId', 'SubAccountName', 'SubAccountType',
    'ResourceId', 'ResourceName', 'SkuId', 'SkuMeter', 'ConsumedQuantity', 'ConsumedUnit',
    'BilledCost', 'EffectiveCost', 'ListCost', 'ContractedCost',
    'x_RequestCount', 'x_InputTokens', 'x_CacheReadTokens', 'x_CacheWriteTokens', 'x_OutputTokens',
    'x_UnsplitRequests', 'x_UpstreamProviderCost',
] as const;

function csvCell(value: unknown): string {
    if (value === undefined || value === null) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Neutralise spreadsheet formula injection as well as quoting.
    const safe = /^[=+\-@]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function focusRecordsToCsv(records: FocusRecord[]): string {
    const lines = [CSV_COLUMNS.join(',')];
    for (const record of records) {
        lines.push(CSV_COLUMNS.map((column) => csvCell(record[column])).join(','));
    }
    return lines.join('\n') + '\n';
}
