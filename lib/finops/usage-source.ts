/**
 * Reads the FOCUS daily rollup for an organization (or one of its projects).
 *
 * The aggregation runs in Postgres (`focus_usage_daily`, migration 20261014_120000_costgraph_finops)
 * because an organization's month is far more ai_requests rows than PostgREST returns in one
 * response, and the export only ever needs the rollup.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
    toFocusRecord,
    type FocusRecord,
    type SubAccountMode,
    type UsageRollupRow,
} from './focus';

/** Rows per page. Large enough that a typical day is one page; CostGraph accepts up to 32 MB. */
export const FOCUS_PAGE_SIZE = 5000;
/** A single read may span at most this many days. */
export const FOCUS_MAX_WINDOW_DAYS = 92;

export interface UsageScope {
    organizationId: string;
    /** Restrict to one project. Omitted = every project in the organization. */
    projectId?: string | null;
}

export interface OrganizationIdentity {
    id: string;
    name: string;
}

export async function loadOrganizationIdentity(
    supabase: SupabaseClient,
    organizationId: string,
): Promise<OrganizationIdentity> {
    const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single();
    if (error || !data) throw new Error(`Organization ${organizationId} not found`);
    return { id: data.id as string, name: (data.name as string) || organizationId };
}

export async function resolveScopeProjectIds(
    supabase: SupabaseClient,
    scope: UsageScope,
): Promise<string[]> {
    let query = supabase.from('projects').select('id').eq('organization_id', scope.organizationId);
    if (scope.projectId) query = query.eq('id', scope.projectId);
    const { data, error } = await query;
    if (error) throw new Error(`Could not list projects: ${error.message}`);
    return (data ?? []).map((row) => row.id as string);
}

export interface RollupPage {
    rows: UsageRollupRow[];
    hasMore: boolean;
}

export async function fetchRollupPage(
    supabase: SupabaseClient,
    params: {
        projectIds: string[];
        start: string;
        end: string;
        subAccount: SubAccountMode;
        limit: number;
        offset: number;
    },
): Promise<RollupPage> {
    if (params.projectIds.length === 0) return { rows: [], hasMore: false };
    const { data, error } = await supabase.rpc('focus_usage_daily', {
        p_project_ids: params.projectIds,
        p_start: params.start,
        p_end: params.end,
        p_sub_account: params.subAccount,
        p_limit: params.limit,
        p_offset: params.offset,
    });
    if (error) throw new Error(`Usage rollup failed: ${error.message}`);
    const payload = (data ?? {}) as { rows?: UsageRollupRow[]; has_more?: boolean };
    return { rows: payload.rows ?? [], hasMore: Boolean(payload.has_more) };
}

export interface FocusPage {
    records: FocusRecord[];
    hasMore: boolean;
    nextOffset: number;
}

/** One page of FOCUS records for a scope and window. */
export async function readFocusPage(
    supabase: SupabaseClient,
    params: {
        organization: OrganizationIdentity;
        projectIds: string[];
        start: string;
        end: string;
        subAccount: SubAccountMode;
        limit?: number;
        offset?: number;
    },
): Promise<FocusPage> {
    const limit = Math.min(Math.max(params.limit ?? FOCUS_PAGE_SIZE, 1), FOCUS_PAGE_SIZE);
    const offset = Math.max(params.offset ?? 0, 0);
    const page = await fetchRollupPage(supabase, {
        projectIds: params.projectIds,
        start: params.start,
        end: params.end,
        subAccount: params.subAccount,
        limit,
        offset,
    });
    const ctx = {
        organizationId: params.organization.id,
        organizationName: params.organization.name,
        subAccount: params.subAccount,
    };
    return {
        records: page.rows.map((row) => toFocusRecord(row, ctx)),
        hasMore: page.hasMore,
        nextOffset: offset + page.rows.length,
    };
}

/**
 * Parse a window from `start`/`end` query values: RFC 3339 instants or YYYY-MM-DD dates (UTC
 * midnight). Defaults to yesterday, the most recent settled day.
 */
export function parseFocusWindow(
    startRaw: string | null,
    endRaw: string | null,
    now: Date = new Date(),
): { start: string; end: string } | { error: string } {
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const parse = (raw: string): Date | null => {
        const value = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const start = startRaw ? parse(startRaw) : new Date(todayUtc - 86_400_000);
    const end = endRaw ? parse(endRaw) : new Date(todayUtc);
    if (!start) return { error: 'start must be an RFC 3339 timestamp or a YYYY-MM-DD date' };
    if (!end) return { error: 'end must be an RFC 3339 timestamp or a YYYY-MM-DD date' };
    if (end <= start) return { error: 'end must be after start' };
    if ((end.getTime() - start.getTime()) / 86_400_000 > FOCUS_MAX_WINDOW_DAYS) {
        return { error: `The window may span at most ${FOCUS_MAX_WINDOW_DAYS} days` };
    }
    return { start: start.toISOString(), end: end.toISOString() };
}
