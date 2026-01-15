import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

// Convert array of objects to CSV string
function toCSV(data: Record<string, unknown>[], columns: string[]): string {
    if (data.length === 0) return columns.join(',') + '\n';

    const header = columns.join(',');
    const rows = data.map(row =>
        columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            const str = String(value);
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',')
    );

    return [header, ...rows].join('\n');
}

// GET /api/projects/[projectId]/export
// Query params:
// - type: 'logs' | 'analytics' | 'security-incidents'
// - format: 'csv' | 'json'
// - from: ISO date string
// - to: ISO date string
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { projectId } = await params;
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    // Verify auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id, name, organization_id')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'logs';
    const format = searchParams.get('format') || 'csv';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const environment = searchParams.get('environment') || 'production';

    try {
        let data: Record<string, unknown>[] = [];
        let columns: string[] = [];
        let filename = '';

        if (type === 'logs') {
            // Get API keys for environment
            const { data: allApiKeys } = await supabaseAdmin
                .from('api_keys')
                .select('id, environment, key_prefix')
                .eq('project_id', projectId)
                .is('revoked_at', null);

            const apiKeyIds = allApiKeys?.filter(key => {
                if (key.environment) {
                    return environment === 'production'
                        ? key.environment === 'production'
                        : key.environment === 'test';
                }
                const isTestKey = key.key_prefix?.includes('_test');
                return environment === 'production' ? !isTestKey : isTestKey;
            }).map(k => k.id) || [];

            // Build query
            let query = supabaseAdmin
                .from('ai_requests')
                .select('id, created_at, status, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, safety_score, error_message')
                .eq('project_id', projectId)
                .in('api_key_id', apiKeyIds)
                .order('created_at', { ascending: false })
                .limit(10000);

            if (from) query = query.gte('created_at', from);
            if (to) query = query.lte('created_at', to);

            const { data: logs, error } = await query;
            if (error) throw error;

            data = logs || [];
            columns = ['id', 'created_at', 'status', 'model', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'cost_usd', 'latency_ms', 'safety_score', 'error_message'];
            filename = `logs-${projectId}-${new Date().toISOString().split('T')[0]}`;

        } else if (type === 'security-incidents') {
            let query = supabaseAdmin
                .from('security_incidents')
                .select('id, created_at, incident_type, severity, risk_score, action_taken, description, input_text, output_text')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(10000);

            if (from) query = query.gte('created_at', from);
            if (to) query = query.lte('created_at', to);

            const { data: incidents, error } = await query;
            if (error) throw error;

            // Truncate long text fields for export
            data = (incidents || []).map(inc => ({
                ...inc,
                input_text: inc.input_text?.substring(0, 500) || '',
                output_text: inc.output_text?.substring(0, 500) || '',
            }));
            columns = ['id', 'created_at', 'incident_type', 'severity', 'risk_score', 'action_taken', 'description', 'input_text', 'output_text'];
            filename = `security-incidents-${projectId}-${new Date().toISOString().split('T')[0]}`;

        } else if (type === 'analytics') {
            // Aggregate daily stats
            let query = supabaseAdmin
                .from('ai_requests')
                .select('created_at, status, model, prompt_tokens, completion_tokens, cost_usd, latency_ms')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(50000);

            if (from) query = query.gte('created_at', from);
            if (to) query = query.lte('created_at', to);

            const { data: requests, error } = await query;
            if (error) throw error;

            // Aggregate by day
            const dailyStats: Record<string, {
                date: string;
                requests: number;
                success: number;
                failed: number;
                total_tokens: number;
                total_cost: number;
                avg_latency: number;
                latencies: number[];
            }> = {};

            (requests || []).forEach(req => {
                const date = req.created_at.split('T')[0];
                if (!dailyStats[date]) {
                    dailyStats[date] = {
                        date,
                        requests: 0,
                        success: 0,
                        failed: 0,
                        total_tokens: 0,
                        total_cost: 0,
                        avg_latency: 0,
                        latencies: [],
                    };
                }
                dailyStats[date].requests++;
                if (req.status === 'success') dailyStats[date].success++;
                else dailyStats[date].failed++;
                dailyStats[date].total_tokens += (req.prompt_tokens || 0) + (req.completion_tokens || 0);
                dailyStats[date].total_cost += req.cost_usd || 0;
                if (req.latency_ms) dailyStats[date].latencies.push(req.latency_ms);
            });

            // Calculate averages
            data = Object.values(dailyStats).map(d => ({
                date: d.date,
                requests: d.requests,
                success: d.success,
                failed: d.failed,
                total_tokens: d.total_tokens,
                total_cost: d.total_cost.toFixed(4),
                avg_latency_ms: d.latencies.length > 0
                    ? Math.round(d.latencies.reduce((a, b) => a + b, 0) / d.latencies.length)
                    : 0,
            })).sort((a, b) => b.date.localeCompare(a.date));

            columns = ['date', 'requests', 'success', 'failed', 'total_tokens', 'total_cost', 'avg_latency_ms'];
            filename = `analytics-${projectId}-${new Date().toISOString().split('T')[0]}`;

        } else {
            return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
        }

        // Return response based on format
        if (format === 'json') {
            return new NextResponse(JSON.stringify(data, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${filename}.json"`,
                },
            });
        } else {
            const csv = toCSV(data, columns);
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${filename}.csv"`,
                },
            });
        }

    } catch (error) {
        console.error('[Export API] Error:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
