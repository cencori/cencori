/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
    billingPeriodFor,
    focusRecordsToCsv,
    toFocusRecord,
    usdString,
    type UsageRollupRow,
} from '@/lib/finops/focus';
import { parseFocusWindow } from '@/lib/finops/usage-source';

const ctx = { organizationId: 'org_1', organizationName: 'Acme', subAccount: 'end_user' as const };

function row(overrides: Partial<UsageRollupRow> = {}): UsageRollupRow {
    return {
        day: '2026-10-12',
        project_id: 'proj_1',
        project_name: 'Prod bot',
        environment: 'production',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        endpoint_family: 'chat',
        sub_account_id: 'cust_42',
        requests: 3,
        prompt_tokens: 1_800,
        completion_tokens: 280,
        total_tokens: 2_080,
        cache_read_tokens: 800,
        cache_write_tokens: 100,
        uncached_prompt_tokens: 900,
        unsplit_requests: 0,
        charge_usd: 0.016,
        provider_cost_usd: 0.016,
        ...overrides,
    };
}

describe('toFocusRecord', () => {
    it('produces the columns CostGraph requires on every pushed row', () => {
        const record = toFocusRecord(row(), ctx);
        for (const column of [
            'BillingAccountId', 'BillingCurrency', 'BillingPeriodStart', 'BillingPeriodEnd',
            'ChargePeriodStart', 'ChargePeriodEnd', 'ChargeCategory', 'Provider', 'ServiceName',
            'BilledCost', 'EffectiveCost', 'ListCost',
        ]) {
            expect(record[column], column).toBeTruthy();
        }
        expect(record.BillingCurrency).toBe('USD');
        expect(record.ChargeCategory).toBe('Usage');
        expect(record.ServiceCategory).toBe('AI and Machine Learning');
    });

    it('covers exactly the UTC day and its calendar month', () => {
        const record = toFocusRecord(row(), ctx);
        expect(record.ChargePeriodStart).toBe('2026-10-12T00:00:00.000Z');
        expect(record.ChargePeriodEnd).toBe('2026-10-13T00:00:00.000Z');
        expect(record.BillingPeriodStart).toBe('2026-10-01T00:00:00.000Z');
        expect(record.BillingPeriodEnd).toBe('2026-11-01T00:00:00.000Z');
    });

    it('sends costs and quantities as decimal strings', () => {
        const record = toFocusRecord(row(), ctx);
        expect(record.BilledCost).toBe('0.016');
        expect(record.ConsumedQuantity).toBe('2080');
        expect(record.ConsumedUnit).toBe('Tokens');
        expect(record.SkuId).toBe('anthropic/claude-sonnet-5');
        expect(record.Publisher).toBe('anthropic');
    });

    /** FinOps tools show ServiceName as the service; it names the work, never "gateway". */
    it('names the service after the work done, not how the traffic arrived', () => {
        expect(toFocusRecord(row(), ctx).ServiceName).toBe('Cencori Text Generation');
        expect(toFocusRecord(row({ endpoint_family: 'embeddings' }), ctx).ServiceName).toBe('Cencori Embeddings');
        expect(toFocusRecord(row({ endpoint_family: 'images' }), ctx).ServiceName).toBe('Cencori Image Generation');
        expect(toFocusRecord(row({ endpoint_family: 'something-new' }), ctx).ServiceName).toBe('Cencori Text Generation');
        for (const family of ['chat', 'embeddings', 'images', 'audio', 'vision', 'documents', 'moderation', 'web']) {
            expect(String(toFocusRecord(row({ endpoint_family: family }), ctx).ServiceName)).not.toMatch(/gateway/i);
        }
    });

    it('carries every token bucket as an extension column', () => {
        const record = toFocusRecord(row(), ctx);
        expect(record).toMatchObject({
            x_InputTokens: '900',
            x_CacheReadTokens: '800',
            x_CacheWriteTokens: '100',
            x_OutputTokens: '280',
            x_RequestCount: '3',
        });
    });

    /** BYOK spend is on the customer's own provider bill; reporting it here would count it twice. */
    it('reports BYOK usage at zero cost while keeping the upstream cost visible', () => {
        const record = toFocusRecord(row({ charge_usd: 0, provider_cost_usd: 0.25 }), ctx);
        expect(record.BilledCost).toBe('0');
        expect(record.EffectiveCost).toBe('0');
        expect(record.x_UpstreamProviderCost).toBe('0.25');
    });

    it('counts requests when the usage was not tokenised', () => {
        const record = toFocusRecord(row({ endpoint_family: 'images', total_tokens: 0, requests: 4 }), ctx);
        expect(record.ConsumedQuantity).toBe('4');
        expect(record.ConsumedUnit).toBe('Requests');
        expect(record.SkuMeter).toBe('images/requests');
    });

    it('fills the sub-account only when there is one', () => {
        expect(toFocusRecord(row(), ctx)).toMatchObject({ SubAccountId: 'cust_42', SubAccountType: 'End User' });
        // CostGraph rejects SubAccountName/Type without an id.
        const anonymous = toFocusRecord(row({ sub_account_id: null }), ctx);
        expect(anonymous.SubAccountId).toBeUndefined();
        expect(anonymous.SubAccountType).toBeUndefined();
        expect(toFocusRecord(row(), { ...ctx, subAccount: 'none' }).SubAccountId).toBeUndefined();
        expect(toFocusRecord(row({ sub_account_id: 'proj_1' }), { ...ctx, subAccount: 'project' }))
            .toMatchObject({ SubAccountName: 'Prod bot', SubAccountType: 'Project' });
    });

    it('treats null buckets as zero rather than dropping the column', () => {
        const record = toFocusRecord(row({ cache_read_tokens: null, cache_write_tokens: null, uncached_prompt_tokens: null, unsplit_requests: 2 }), ctx);
        expect(record.x_CacheReadTokens).toBe('0');
        expect(record.x_UnsplitRequests).toBe('2');
    });
});

describe('usdString', () => {
    it('keeps sub-cent precision without float artefacts', () => {
        expect(usdString(0.1 + 0.2)).toBe('0.3');
        expect(usdString('0.00000123')).toBe('0.00000123');
        expect(usdString(12)).toBe('12');
        expect(usdString(null)).toBe('0');
        expect(usdString(-0)).toBe('0');
    });
});

describe('billingPeriodFor', () => {
    it('rolls December into the next year', () => {
        expect(billingPeriodFor('2026-12-31')).toEqual({
            start: '2026-12-01T00:00:00.000Z',
            end: '2027-01-01T00:00:00.000Z',
        });
    });
});

describe('focusRecordsToCsv', () => {
    it('quotes and neutralises cells a spreadsheet would execute', () => {
        const csv = focusRecordsToCsv([toFocusRecord(row({ project_name: '=HYPERLINK("x")', model: 'a,b' }), ctx)]);
        const [header, line] = csv.trim().split('\n');
        expect(header.split(',')[0]).toBe('BillingAccountId');
        expect(line).toContain(`"'=HYPERLINK(""x"")"`);
        expect(line).toContain('"anthropic/a,b"');
    });
});

describe('parseFocusWindow', () => {
    const now = new Date('2026-10-14T09:30:00Z');

    it('defaults to yesterday, the latest settled day', () => {
        expect(parseFocusWindow(null, null, now)).toEqual({
            start: '2026-10-13T00:00:00.000Z',
            end: '2026-10-14T00:00:00.000Z',
        });
    });

    it('accepts dates and instants', () => {
        expect(parseFocusWindow('2026-10-01', '2026-10-02T12:00:00Z', now)).toEqual({
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-10-02T12:00:00.000Z',
        });
    });

    it('rejects an inverted or oversized window', () => {
        expect(parseFocusWindow('2026-10-02', '2026-10-01', now)).toHaveProperty('error');
        expect(parseFocusWindow('2026-01-01', '2026-10-01', now)).toHaveProperty('error');
        expect(parseFocusWindow('yesterday', null, now)).toHaveProperty('error');
    });
});
