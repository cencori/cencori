import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { RequestLogsResponse, RequestLogsQuery } from '@/lib/types/audit';

// Helper to calculate time range
function getTimeRange(timeRange?: string, startDate?: string, endDate?: string) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (timeRange === 'custom' && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
    } else {
        switch (timeRange) {
            case '1h':
                start = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
            default:
                start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
        }
    }

    return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId } = params;

    try {
        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const query: RequestLogsQuery = {
            status: (searchParams.get('status') as RequestLogsQuery['status']) || 'all',
            model: searchParams.get('model') || undefined,
            environment: (searchParams.get('environment') as 'production' | 'test') || undefined,
            timeRange: (searchParams.get('timeRange') as RequestLogsQuery['timeRange']) || '30d',
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
            search: searchParams.get('search') || undefined,
            page: parseInt(searchParams.get('page') || '1'),
            perPage: parseInt(searchParams.get('perPage') || '50'),
        };

        // Validate project access (RLS will also enforce this)
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('id, organization_id')
            .eq('id', projectId)
            .single();

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // Calculate time range
        const { start, end } = getTimeRange(query.timeRange, query.startDate, query.endDate);

        // Build base query
        let logsQuery = supabaseAdmin
            .from('ai_requests')
            .select('*', { count: 'exact' })
            .eq('project_id', projectId)
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });

        // Apply filters
        if (query.status && query.status !== 'all') {
            logsQuery = logsQuery.eq('status', query.status);
        }

        if (query.model) {
            logsQuery = logsQuery.eq('model', query.model);
        }

        // Search functionality (search in request content)
        if (query.search) {
            logsQuery = logsQuery.ilike('request_payload', `%${query.search}%`);
        }

        // Pagination
        const offset = (query.page! - 1) * query.perPage!;
        logsQuery = logsQuery.range(offset, offset + query.perPage! - 1);

        const { data: logs, error: logsError, count } = await logsQuery;

        if (logsError) {
            console.error('[Logs API] Error fetching logs:', logsError);
            return NextResponse.json(
                { error: 'Failed to fetch logs' },
                { status: 500 }
            );
        }

        // Get summary statistics
        const { data: summaryData } = await supabaseAdmin
            .from('ai_requests')
            .select('status, latency_ms, cost_usd')
            .eq('project_id', projectId)
            .gte('created_at', start)
            .lte('created_at', end);

        const summary = {
            totalRequests: summaryData?.length || 0,
            successRate: summaryData
                ? (summaryData.filter(r => r.status === 'success').length / summaryData.length) * 100
                : 0,
            avgLatency: summaryData
                ? summaryData.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / summaryData.length
                : 0,
            totalCost: summaryData
                ? summaryData.reduce((sum, r) => sum + (r.cost_usd || 0), 0)
                : 0,
        };

        // Transform logs for response
        const transformedLogs = logs?.map(log => ({
            id: log.id,
            created_at: log.created_at,
            status: log.status,
            model: log.model,
            prompt_tokens: log.prompt_tokens || 0,
            completion_tokens: log.completion_tokens || 0,
            total_tokens: log.total_tokens || 0,
            cost_usd: log.cost_usd || 0,
            latency_ms: log.latency_ms || 0,
            safety_score: log.safety_score,
            error_message: log.error_message,
            filtered_reasons: log.filtered_reasons,
            request_preview: log.request_payload?.messages?.[0]?.content?.substring(0, 100) || '',
            environment: (log.api_key_id?.startsWith('cen_test_') ? 'test' : 'production') as 'production' | 'test',
        })) || [];

        const response: RequestLogsResponse = {
            requests: transformedLogs,
            pagination: {
                page: query.page!,
                perPage: query.perPage!,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / query.perPage!),
            },
            summary,
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('[Logs API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
