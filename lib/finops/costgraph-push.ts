/**
 * Push Cencori usage to CostGraph as FOCUS 1.2 records.
 *
 * Follows CostGraph's documented daily loop (docs.costgraph.ai/costgraph/integrations/focus-push):
 *   - each settled UTC day is sent once with `complete: true`, so a re-run replaces it rather than
 *     double-counting;
 *   - once a month has closed (from the 3rd of the next month), the whole month is re-sent with
 *     `complete: true`, so late rows correct themselves without any deletion on either side;
 *   - a window too large for one request is paged: the first page carries `complete: true`, later
 *     pages append under the same `batch_id` with their `row_offset`, so a retried page rewrites its
 *     own rows and never wipes the pages after it.
 *
 * Each organization has its own CostGraph connection (`fpc_…`) and key (`focus:write`), stored
 * encrypted in `organization_finops_connections`.
 */

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptApiKey } from '@/lib/encryption';
import { FOCUS_VERSION, isSubAccountMode, type SubAccountMode } from './focus';
import { createCostGraphPlatformClient, type CostGraphPlatformClient } from './costgraph';
import { getValidAccessToken, oauthClientId } from './costgraph-oauth';
import { resolveConsoleBaseUrl } from '@/lib/auth-redirect';
import {
    FOCUS_PAGE_SIZE,
    loadOrganizationIdentity,
    readFocusPage,
    resolveScopeProjectIds,
    type OrganizationIdentity,
} from './usage-source';

/** Days sent on the first run of a new connection: the month so far. */
const MAX_CATCH_UP_DAYS = 35;
/** Re-send the previous month once this day of the month is reached (UTC). */
const MONTH_CLOSE_DAY = 3;

export interface FinopsConnectionRow {
    id: string;
    organization_id: string;
    provider: 'costgraph';
    /** Null for an OAuth connection CostGraph has not created a push connection for yet. */
    connection_id: string | null;
    /** Absent until migration 20261014_180000_costgraph_oauth; treated as 'api_key'. */
    auth_method?: 'api_key' | 'oauth';
    api_key_encrypted: string | null;
    sub_account: string;
    enabled: boolean;
    last_pushed_day: string | null;
    last_closed_month: string | null;
}

export interface PushWindowResult {
    start: string;
    end: string;
    rows: number;
    pages: number;
    skipped?: 'empty';
}

export interface ConnectionRunResult {
    connectionId: string;
    organizationId: string;
    status: 'ok' | 'error';
    windows: PushWindowResult[];
    rows: number;
    error?: string;
}

function isoDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
    return isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000));
}

function monthStart(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function previousMonthStart(date: Date): string {
    return monthStart(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
}

/**
 * The days a run should send, oldest first: everything after the last pushed day up to and
 * including yesterday (UTC). A connection that has never pushed starts at the first of the
 * current month; a long outage catches up at most MAX_CATCH_UP_DAYS at a time.
 */
export function daysToPush(lastPushedDay: string | null, now: Date): string[] {
    const yesterday = addDays(isoDay(now), -1);
    let from = lastPushedDay ? addDays(lastPushedDay, 1) : monthStart(new Date(Date.parse(`${yesterday}T00:00:00Z`)));
    const earliest = addDays(yesterday, -(MAX_CATCH_UP_DAYS - 1));
    if (from < earliest) from = earliest;
    const days: string[] = [];
    for (let day = from; day <= yesterday; day = addDays(day, 1)) days.push(day);
    return days;
}

/** The closed month to re-send this run, if any: [start, end) as YYYY-MM-DD. */
export function monthToRestate(lastClosedMonth: string | null, now: Date): { start: string; end: string } | null {
    if (now.getUTCDate() < MONTH_CLOSE_DAY) return null;
    const start = previousMonthStart(now);
    if (lastClosedMonth && lastClosedMonth >= start) return null;
    return { start, end: monthStart(now) };
}

/** Send [start, end) to CostGraph, replacing what was there. */
export async function pushWindow(params: {
    supabase: SupabaseClient;
    client: CostGraphPlatformClient;
    organization: OrganizationIdentity;
    projectIds: string[];
    connectionId: string;
    subAccount: SubAccountMode;
    start: string;
    end: string;
    pageSize?: number;
}): Promise<PushWindowResult> {
    const startIso = `${params.start}T00:00:00.000Z`;
    const endIso = `${params.end}T00:00:00.000Z`;
    const batchId = `cencori-${params.start}-${params.end}-${crypto.randomUUID().slice(0, 8)}`;
    let offset = 0;
    let pages = 0;

    for (;;) {
        const page = await readFocusPage(params.supabase, {
            organization: params.organization,
            projectIds: params.projectIds,
            start: startIso,
            end: endIso,
            subAccount: params.subAccount,
            limit: params.pageSize ?? FOCUS_PAGE_SIZE,
            offset,
        });

        if (page.records.length === 0 && pages === 0) {
            // CostGraph refuses `complete: true` with no rows (it would silently clear the window).
            // A window with no usage has nothing to replace, so there is nothing to send.
            return { start: params.start, end: params.end, rows: 0, pages: 0, skipped: 'empty' };
        }

        await params.client.pushFocus({
            connection_id: params.connectionId,
            focus_version: FOCUS_VERSION,
            charge_period_start: startIso,
            charge_period_end: endIso,
            rows: page.records,
            batch_id: batchId,
            row_offset: offset,
            // `overwrite` is what CostGraph honours; `complete` is what its docs name (see FocusPushRequest).
            ...(pages === 0 ? { complete: true, overwrite: true } : {}),
        });

        pages += 1;
        offset = page.nextOffset;
        if (!page.hasMore) break;
    }

    return { start: params.start, end: params.end, rows: offset, pages };
}

/**
 * One run for one connection: pending days, then the closed month if it is due. Progress is saved
 * after each day, so a failure part-way resumes where it stopped rather than starting over.
 */
export async function runConnectionPush(
    supabase: SupabaseClient,
    connection: FinopsConnectionRow,
    options: { now?: Date; client?: CostGraphPlatformClient } = {},
): Promise<ConnectionRunResult> {
    const now = options.now ?? new Date();
    const result: ConnectionRunResult = {
        connectionId: connection.id,
        organizationId: connection.organization_id,
        status: 'ok',
        windows: [],
        rows: 0,
    };

    const save = (patch: Record<string, unknown>) =>
        supabase.from('organization_finops_connections')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', connection.id);

    try {
        const connectionId = connection.connection_id;
        if (!connectionId) {
            throw new Error('Waiting for CostGraph to create the push connection for this organization');
        }
        const client = options.client ?? await platformClientFor(supabase, connection);
        const subAccount: SubAccountMode = isSubAccountMode(connection.sub_account) ? connection.sub_account : 'project';
        const [organization, projectIds] = await Promise.all([
            loadOrganizationIdentity(supabase, connection.organization_id),
            resolveScopeProjectIds(supabase, { organizationId: connection.organization_id }),
        ]);
        const common = { supabase, client, organization, projectIds, connectionId, subAccount };

        for (const day of daysToPush(connection.last_pushed_day, now)) {
            const window = await pushWindow({ ...common, start: day, end: addDays(day, 1) });
            result.windows.push(window);
            result.rows += window.rows;
            await save({ last_pushed_day: day });
        }

        const month = monthToRestate(connection.last_closed_month, now);
        if (month) {
            const window = await pushWindow({ ...common, start: month.start, end: month.end });
            result.windows.push(window);
            result.rows += window.rows;
            await save({ last_closed_month: month.start });
        }
    } catch (error) {
        result.status = 'error';
        result.error = error instanceof Error ? error.message : String(error);
    }

    await save({
        last_run_at: new Date().toISOString(),
        last_run_status: result.status,
        last_run_error: result.error?.slice(0, 1000) ?? null,
        last_run_rows: result.rows,
    });

    return result;
}

/** The credential a connection pushes with: its OAuth token (refreshed as needed) or its API key. */
async function platformClientFor(supabase: SupabaseClient, connection: FinopsConnectionRow): Promise<CostGraphPlatformClient> {
    if (connection.auth_method === 'oauth') {
        const accessToken = await getValidAccessToken(supabase, connection.id, {
            clientId: oauthClientId(resolveConsoleBaseUrl()),
        });
        return createCostGraphPlatformClient({ accessToken });
    }
    if (!connection.api_key_encrypted) throw new Error('This CostGraph connection has no API key stored');
    return createCostGraphPlatformClient(decryptApiKey(connection.api_key_encrypted, connection.organization_id));
}

/** Run one connection's push right after it is connected. Never throws: the nightly run retries. */
export async function sendFirstPush(rowId: string): Promise<void> {
    try {
        const { createAdminClient } = await import('@/lib/supabaseAdmin');
        const supabase = createAdminClient();
        const { data } = await supabase.from('organization_finops_connections').select('*').eq('id', rowId).single();
        if (data) await runConnectionPush(supabase, data as FinopsConnectionRow);
    } catch (error) {
        console.error('[FinOps] first push failed:', error);
    }
}

/** Every enabled connection, least recently run first, within a time budget. */
export async function runAllFinopsPushes(
    supabase: SupabaseClient,
    options: { now?: Date; budgetMs?: number; limit?: number } = {},
): Promise<ConnectionRunResult[]> {
    const startedAt = Date.now();
    const budgetMs = options.budgetMs ?? 240_000;
    const { data, error } = await supabase
        .from('organization_finops_connections')
        // '*' rather than a column list: auth_method arrives by a later migration, and naming it
        // here would fail every push until that migration is applied.
        .select('*')
        .eq('enabled', true)
        .order('last_run_at', { ascending: true, nullsFirst: true })
        .limit(options.limit ?? 100);
    if (error) throw new Error(`Could not list FinOps connections: ${error.message}`);

    const results: ConnectionRunResult[] = [];
    for (const connection of (data ?? []) as FinopsConnectionRow[]) {
        if (Date.now() - startedAt > budgetMs) break;
        results.push(await runConnectionPush(supabase, connection, { now: options.now }));
    }
    return results;
}
