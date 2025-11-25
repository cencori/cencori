import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { SecurityIncidentsResponse, SecurityIncidentsQuery } from '@/lib/types/audit';

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
        const query: SecurityIncidentsQuery = {
            severity: (searchParams.get('severity') as SecurityIncidentsQuery['severity']) || 'all',
            type: (searchParams.get('type') as SecurityIncidentsQuery['type']) || 'all',
            reviewed: searchParams.get('reviewed') === 'true' ? true : searchParams.get('reviewed') === 'false' ? false : undefined,
            timeRange: (searchParams.get('timeRange') as SecurityIncidentsQuery['timeRange']) || '30d',
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
            page: parseInt(searchParams.get('page') || '1'),
            perPage: parseInt(searchParams.get('perPage') || '50'),
        };

        // Validate project access
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('id')
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

        // Build incidents query
        let incidentsQuery = supabaseAdmin
            .from('security_incidents')
            .select('*', { count: 'exact' })
            .eq('project_id', projectId)
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });

        // Apply filters
        if (query.severity && query.severity !== 'all') {
            incidentsQuery = incidentsQuery.eq('severity', query.severity);
        }

        if (query.type && query.type !== 'all') {
            incidentsQuery = incidentsQuery.eq('incident_type', query.type);
        }

        if (query.reviewed !== undefined) {
            incidentsQuery = incidentsQuery.eq('reviewed', query.reviewed);
        }

        // Pagination
        const offset = (query.page! - 1) * query.perPage!;
        incidentsQuery = incidentsQuery.range(offset, offset + query.perPage! - 1);

        const { data: incidents, error: incidentsError, count } = await incidentsQuery;

        if (incidentsError) {
            console.error('[Security Incidents API] Error fetching incidents:', incidentsError);
            return NextResponse.json(
                { error: 'Failed to fetch security incidents' },
                { status: 500 }
            );
        }

        // Get summary statistics (for the sidebar cards)
        const { data: summaryData } = await supabaseAdmin
            .from('security_incidents')
            .select('severity, reviewed')
            .eq('project_id', projectId)
            .gte('created_at', start)
            .lte('created_at', end);

        const summary = {
            critical: summaryData?.filter(i => i.severity === 'critical').length || 0,
            high: summaryData?.filter(i => i.severity === 'high').length || 0,
            medium: summaryData?.filter(i => i.severity === 'medium').length || 0,
            low: summaryData?.filter(i => i.severity === 'low').length || 0,
            totalUnreviewed: summaryData?.filter(i => !i.reviewed).length || 0,
        };

        const response: SecurityIncidentsResponse = {
            incidents: incidents || [],
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
        console.error('[Security Incidents API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
