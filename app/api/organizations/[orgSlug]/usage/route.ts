import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';

interface RouteParams {
    params: Promise<{ orgSlug: string }>;
}

type HourlyBucket = { hour: string; count: number; input_tokens: number; output_tokens: number };

export type OrgUsageRollup = {
    total_requests: number;
    successful_requests: number;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    total_cost: number;
    avg_latency: number;
    model_usage: Record<string, number>;
    provider_usage: Record<string, number>;
    hourly: HourlyBucket[];
};

const RANGE_MS: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};

const PAGE_SIZE = 1000;

// Used only until 20261013_000000_org_usage_stats.sql is applied. Reads the
// narrow columns page by page — never request_payload — and rolls up here.
async function rollupFromRows(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    projectIds: string[],
    start: string,
): Promise<OrgUsageRollup> {
    const rollup: OrgUsageRollup = {
        total_requests: 0, successful_requests: 0, total_tokens: 0, input_tokens: 0,
        output_tokens: 0, total_cost: 0, avg_latency: 0, model_usage: {}, provider_usage: {}, hourly: [],
    };
    const hourly = new Map<string, HourlyBucket>();
    let latencySum = 0;
    let latencyCount = 0;

    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabaseAdmin
            .from('ai_requests')
            .select('created_at, status, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, model, provider')
            .in('project_id', projectIds)
            .gte('created_at', start)
            .order('created_at', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const r of data) {
            const input = Number(r.prompt_tokens || 0);
            const output = Number(r.completion_tokens || 0);
            rollup.total_requests += 1;
            if (r.status === 'success') rollup.successful_requests += 1;
            rollup.total_tokens += Number(r.total_tokens || 0);
            rollup.input_tokens += input;
            rollup.output_tokens += output;
            rollup.total_cost += Number(r.cost_usd || 0);
            if (r.latency_ms != null) {
                latencySum += Number(r.latency_ms);
                latencyCount += 1;
            }
            if (r.model) rollup.model_usage[r.model] = (rollup.model_usage[r.model] || 0) + 1;
            const provider = r.provider || 'unknown';
            rollup.provider_usage[provider] = (rollup.provider_usage[provider] || 0) + 1;

            const hourDate = new Date(r.created_at);
            hourDate.setUTCMinutes(0, 0, 0);
            const hour = hourDate.toISOString();
            const bucket = hourly.get(hour) || { hour, count: 0, input_tokens: 0, output_tokens: 0 };
            bucket.count += 1;
            bucket.input_tokens += input;
            bucket.output_tokens += output;
            hourly.set(hour, bucket);
        }

        if (data.length < PAGE_SIZE) break;
    }

    rollup.avg_latency = latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0;
    rollup.hourly = Array.from(hourly.values());
    return rollup;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    const { orgSlug } = await params;
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single();

    if (orgError || !org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!member) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const range = req.nextUrl.searchParams.get('range') || '7d';
    const start = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS['7d'])).toISOString();

    const { data: projects, error: projectsError } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('organization_id', org.id);

    if (projectsError) {
        return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
    }

    const projectIds = (projects || []).map((p) => p.id);
    if (projectIds.length === 0) {
        return NextResponse.json({ rollup: null });
    }

    const { data, error } = await supabaseAdmin.rpc('org_usage_stats', {
        p_project_ids: projectIds,
        p_start: start,
    });

    if (!error) {
        return NextResponse.json({ rollup: data as OrgUsageRollup });
    }

    // PGRST202 / 42883: function not deployed yet.
    if (error.code !== 'PGRST202' && error.code !== '42883') {
        console.error('[org usage] org_usage_stats failed:', error);
        return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
    }

    try {
        return NextResponse.json({ rollup: await rollupFromRows(supabaseAdmin, projectIds, start) });
    } catch (fallbackError) {
        console.error('[org usage] row rollup failed:', fallbackError);
        return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
    }
}
