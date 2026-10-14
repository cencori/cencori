import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { fetchAllRows } from '@/lib/supabase-paginate';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId } = await params;
    const projectAccess = await requireProjectAccess(projectId);
    if (!projectAccess.ok) return projectAccess.response;

    try {
        const body = await req.json();
        const { format = 'csv', filters } = body;

        let startTime: Date | null = null;
        if (filters?.time_range && filters.time_range !== 'all') {
            const now = new Date();
            switch (filters.time_range) {
                case '1h':
                    startTime = new Date(now.getTime() - 60 * 60 * 1000);
                    break;
                case '7d':
                    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '24h':
                default:
                    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            }
        }

        // Only the exported columns, paginated (a single select stops at 1,000
        // rows whatever .limit() says). CSV never includes payloads, so it
        // reads narrow rows up to 10,000. JSON includes request/response
        // payloads (tens of KB each), so it reads them in small pages and
        // stops at 1,000 rows to stay within query and response limits.
        const withPayloads = format === 'json';
        const baseColumns = 'id, created_at, status, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, safety_score, error_message, filtered_reasons';
        type ExportedLog = {
            id: string; created_at: string; status: string | null; model: string | null;
            prompt_tokens: number | null; completion_tokens: number | null; total_tokens: number | null;
            cost_usd: number | null; latency_ms: number | null; safety_score: number | null;
            error_message: string | null; filtered_reasons: string[] | null;
            request_payload?: unknown; response_payload?: unknown;
        };
        let requests: ExportedLog[];
        try {
            requests = await fetchAllRows<ExportedLog>((from, to) => {
                let query = supabaseAdmin
                    .from('ai_requests')
                    .select(withPayloads ? `${baseColumns}, request_payload, response_payload` : baseColumns)
                    .eq('project_id', projectId);
                if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
                if (filters?.model && filters.model !== 'all') query = query.eq('model', filters.model);
                if (startTime) query = query.gte('created_at', startTime.toISOString());
                // The column list is chosen at runtime, which the client's type
                // parser can't follow; the row shape is ExportedLog either way.
                return query
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .range(from, to) as unknown as PromiseLike<{ data: ExportedLog[] | null; error: { message: string } | null }>;
            }, withPayloads ? { pageSize: 100, maxRows: 1_000 } : { maxRows: 10_000 });
        } catch (error) {
            console.error('[Export API] Error fetching requests:', error);
            return NextResponse.json(
                { error: 'Failed to export request logs' },
                { status: 500 }
            );
        }

        if (requests.length === 0) {
            return NextResponse.json(
                { error: 'No requests found for the given filters' },
                { status: 404 }
            );
        }

        if (format === 'csv') {
            const headers = [
                'ID',
                'Timestamp',
                'Status',
                'Model',
                'Prompt Tokens',
                'Completion Tokens',
                'Total Tokens',
                'Cost (USD)',
                'Latency (ms)',
                'Safety Score',
                'Error Message',
                'Filtered Reasons',
            ];

            const csvRows = [headers.join(',')];

            requests.forEach(req => {
                const row = [
                    req.id,
                    req.created_at,
                    req.status,
                    req.model,
                    req.prompt_tokens || 0,
                    req.completion_tokens || 0,
                    req.total_tokens || 0,
                    req.cost_usd || 0,
                    req.latency_ms || 0,
                    req.safety_score || '-',
                    req.error_message ? `"${req.error_message.replace(/"/g, '""')}"` : '-',
                    req.filtered_reasons ? `"${req.filtered_reasons.join('; ').replace(/"/g, '""')}"` : '-',
                ];
                csvRows.push(row.join(','));
            });

            const csv = csvRows.join('\n');
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `cencori-logs-${timestamp}.csv`;

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });

        } else if (format === 'json') {
            const exportData = {
                export_date: new Date().toISOString(),
                project_id: projectId,
                filters: filters || {},
                total_records: requests.length,
                requests: requests.map(req => ({
                    id: req.id,
                    created_at: req.created_at,
                    status: req.status,
                    model: req.model,
                    prompt_tokens: req.prompt_tokens,
                    completion_tokens: req.completion_tokens,
                    total_tokens: req.total_tokens,
                    cost_usd: req.cost_usd,
                    latency_ms: req.latency_ms,
                    safety_score: req.safety_score,
                    error_message: req.error_message,
                    filtered_reasons: req.filtered_reasons,
                    request_payload: req.request_payload,
                    response_payload: req.response_payload,
                })),
            };

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `cencori-logs-${timestamp}.json`;

            return new NextResponse(JSON.stringify(exportData, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        return NextResponse.json(
            { error: 'Invalid format. Use "csv" or "json"' },
            { status: 400 }
        );

    } catch (error) {
        console.error('[Export API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
