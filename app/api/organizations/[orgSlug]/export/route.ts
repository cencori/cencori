import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';

interface RouteParams {
    params: Promise<{ orgSlug: string }>;
}

function toCSV(data: Record<string, unknown>[], columns: string[]): string {
    if (data.length === 0) return columns.join(',') + '\n';

    const header = columns.join(',');
    const rows = data.map(row =>
        columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',')
    );

    return [header, ...rows].join('\n');
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    const { orgSlug } = await params;
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify org membership
    const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .eq('slug', orgSlug)
        .single();

    if (orgError || !org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { data: member } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .single();

    if (!member) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv';
    const from = searchParams.get('from');

    try {
        // Get all project IDs for this org
        const { data: projects } = await supabaseAdmin
            .from('projects')
            .select('id, name')
            .eq('organization_id', org.id);

        const projectIds = projects?.map(p => p.id) || [];
        const projectNames = new Map(projects?.map(p => [p.id, p.name]) || []);

        if (projectIds.length === 0) {
            const columns = ['date', 'project', 'model', 'provider', 'requests', 'success', 'failed', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'total_cost_usd', 'avg_latency_ms'];
            if (format === 'json') {
                return new NextResponse(JSON.stringify([], null, 2), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename="usage-${orgSlug}-${new Date().toISOString().split('T')[0]}.json"`,
                    },
                });
            }
            return new NextResponse(toCSV([], columns), {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="usage-${orgSlug}-${new Date().toISOString().split('T')[0]}.csv"`,
                },
            });
        }

        // Fetch all requests across org projects
        let query = supabaseAdmin
            .from('ai_requests')
            .select('project_id, created_at, status, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false })
            .limit(50000);

        if (from) query = query.gte('created_at', from);

        const { data: requests, error } = await query;
        if (error) throw error;

        // Aggregate by date + project + model + provider
        const aggregation: Record<string, {
            date: string;
            project: string;
            model: string;
            provider: string;
            requests: number;
            success: number;
            failed: number;
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
            total_cost: number;
            latencies: number[];
        }> = {};

        (requests || []).forEach(r => {
            const date = r.created_at.split('T')[0];
            const project = projectNames.get(r.project_id) || r.project_id;
            const model = r.model || 'unknown';
            const provider = r.provider || 'unknown';
            const key = `${date}|${project}|${model}|${provider}`;

            if (!aggregation[key]) {
                aggregation[key] = {
                    date,
                    project,
                    model,
                    provider,
                    requests: 0,
                    success: 0,
                    failed: 0,
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                    total_cost: 0,
                    latencies: [],
                };
            }

            aggregation[key].requests++;
            if (r.status === 'success') aggregation[key].success++;
            else aggregation[key].failed++;
            aggregation[key].prompt_tokens += r.prompt_tokens || 0;
            aggregation[key].completion_tokens += r.completion_tokens || 0;
            aggregation[key].total_tokens += r.total_tokens || 0;
            aggregation[key].total_cost += r.cost_usd || 0;
            if (r.latency_ms) aggregation[key].latencies.push(r.latency_ms);
        });

        const data = Object.values(aggregation).map(d => ({
            date: d.date,
            project: d.project,
            model: d.model,
            provider: d.provider,
            requests: d.requests,
            success: d.success,
            failed: d.failed,
            prompt_tokens: d.prompt_tokens,
            completion_tokens: d.completion_tokens,
            total_tokens: d.total_tokens,
            total_cost_usd: d.total_cost.toFixed(6),
            avg_latency_ms: d.latencies.length > 0
                ? Math.round(d.latencies.reduce((a, b) => a + b, 0) / d.latencies.length)
                : 0,
        })).sort((a, b) => b.date.localeCompare(a.date));

        const columns = ['date', 'project', 'model', 'provider', 'requests', 'success', 'failed', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'total_cost_usd', 'avg_latency_ms'];
        const filename = `usage-${orgSlug}-${new Date().toISOString().split('T')[0]}`;

        if (format === 'json') {
            return new NextResponse(JSON.stringify(data, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${filename}.json"`,
                },
            });
        }

        return new NextResponse(toCSV(data, columns), {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}.csv"`,
            },
        });
    } catch (error) {
        console.error('[Org Export API] Error:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
