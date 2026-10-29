/**
 * Gateway latency by country, before and after the move from Vercel to
 * Brimble (Lagos). Server only: reads raw timings through the
 * analytics_gateway_latency_rows RPC and resolves a country from the IP for
 * rows logged without one (Brimble's edge sends no country header).
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { countryForIp } from '@/lib/geo/ip-country';
import type { LatencyBenchmark, LatencyByCountry } from './types';

/** Maintenance went on (writes to Supabase stopped). Everything before is Vercel. */
export const CUTOVER_START = '2026-10-28T21:25:00Z';
/** Lagos went live. Everything after is Brimble. */
export const CUTOVER_END = '2026-10-29T04:04:00Z';
const BASELINE_DAYS = 14;

type Row = [number, string | null, string | null, number | null, number | null, number | null, number | null, number | null];

function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = (sorted.length - 1) * p;
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo));
}

function summarize(rows: Row[]): LatencyByCountry[] {
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
        const country = row[1] || countryForIp(row[2]) || '??';
        const list = groups.get(country);
        if (list) list.push(row);
        else groups.set(country, [row]);
    }
    const metric = (list: Row[], index: number) =>
        list.map((row) => row[index]).filter((v): v is number => typeof v === 'number' && v >= 0);

    return [...groups.entries()]
        .map(([country, list]) => {
            const preflight = metric(list, 4);
            const providerTtft = metric(list, 5);
            const clientTtft = metric(list, 6);
            const latency = metric(list, 7);
            return {
                country,
                requests: list.length,
                errors: list.filter((row) => (row[3] ?? 0) >= 500).length,
                preflightP50: percentile(preflight, 0.5),
                providerTtftP50: percentile(providerTtft, 0.5),
                clientTtftP50: percentile(clientTtft, 0.5),
                clientTtftP90: percentile(clientTtft, 0.9),
                latencyP50: percentile(latency, 0.5),
                latencyP90: percentile(latency, 0.9),
            };
        })
        .sort((a, b) => b.requests - a.requests);
}

async function fetchRows(startISO: string, endISO: string): Promise<Row[] | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('analytics_gateway_latency_rows', { p_start: startISO, p_end: endISO });
    if (error) {
        console.error('[Analytics] RPC analytics_gateway_latency_rows failed:', error.message);
        return null;
    }
    return (data ?? []) as Row[];
}

export async function getGatewayLatencyBenchmark(): Promise<LatencyBenchmark> {
    const now = new Date().toISOString();
    const baselineStart = new Date(new Date(CUTOVER_START).getTime() - BASELINE_DAYS * 86_400_000).toISOString();
    const [before, after] = await Promise.all([
        fetchRows(baselineStart, CUTOVER_START),
        fetchRows(CUTOVER_END, now),
    ]);
    return {
        before: before ? { label: 'Vercel', from: baselineStart, to: CUTOVER_START, countries: summarize(before) } : null,
        after: after ? { label: 'Lagos', from: CUTOVER_END, to: now, countries: summarize(after) } : null,
        generatedAt: now,
    };
}
