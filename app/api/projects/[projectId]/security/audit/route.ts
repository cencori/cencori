import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

// GET - Fetch security audit log (from both security_audit_log and security_incidents tables)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, organization_id, organizations!inner(owner_id)')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(url.searchParams.get('per_page') || '50'), 100);
    const eventType = url.searchParams.get('event_type');
    const timeRange = url.searchParams.get('time_range') || '7d';

    // Calculate time filter
    let startDate = new Date();
    switch (timeRange) {
        case '1h':
            startDate = new Date(Date.now() - 60 * 60 * 1000);
            break;
        case '24h':
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'all':
            startDate = new Date(0);
            break;
    }

    // Security incident types vs admin event types
    const securityIncidentTypes = ['content_filter', 'intent_analysis', 'jailbreak', 'prompt_injection', 'output_leakage', 'pii_input', 'pii_output'];
    const adminEventTypes = ['settings_updated', 'api_key_created', 'api_key_deleted', 'api_key_rotated', 'webhook_created', 'webhook_deleted', 'incident_reviewed', 'ip_blocked', 'rate_limit_exceeded', 'auth_failed'];

    const allLogs: Array<{
        id: string;
        event_type: string;
        actor_email: string | null;
        actor_ip: string | null;
        details: Record<string, unknown>;
        created_at: string;
    }> = [];

    // Query security_incidents table (for security violations)
    if (!eventType || eventType === 'all' || securityIncidentTypes.includes(eventType)) {
        let incidentsQuery = supabase
            .from('security_incidents')
            .select('*')
            .eq('project_id', projectId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(perPage);

        if (eventType && eventType !== 'all' && securityIncidentTypes.includes(eventType)) {
            incidentsQuery = incidentsQuery.eq('incident_type', eventType);
        }

        const { data: incidents, error: incidentsError } = await incidentsQuery;

        if (incidentsError) {
            console.error('Error fetching security incidents:', incidentsError);
        } else if (incidents) {
            // Map incidents to audit log format
            for (const incident of incidents) {
                allLogs.push({
                    id: incident.id,
                    event_type: incident.incident_type,
                    actor_email: null,
                    actor_ip: null,
                    details: {
                        severity: incident.severity,
                        description: incident.description,
                        action_taken: incident.action_taken,
                        risk_score: incident.risk_score,
                        input_preview: typeof incident.input_text === 'string' ? incident.input_text.substring(0, 100) : null,
                        ...(incident.details && typeof incident.details === 'object' ? incident.details : {}),
                    },
                    created_at: incident.created_at,
                });
            }
        }
    }

    // Query security_audit_log table (for admin events)
    if (!eventType || eventType === 'all' || adminEventTypes.includes(eventType)) {
        let auditQuery = supabase
            .from('security_audit_log')
            .select('*')
            .eq('project_id', projectId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(perPage);

        if (eventType && eventType !== 'all' && adminEventTypes.includes(eventType)) {
            auditQuery = auditQuery.eq('event_type', eventType);
        }

        const { data: auditLogs, error: auditError } = await auditQuery;

        if (auditError) {
            console.error('Error fetching audit logs:', auditError);
        } else if (auditLogs) {
            for (const log of auditLogs) {
                allLogs.push({
                    id: log.id,
                    event_type: log.event_type,
                    actor_email: log.actor_email,
                    actor_ip: log.actor_ip,
                    details: log.details || {},
                    created_at: log.created_at,
                });
            }
        }
    }

    // Sort by created_at descending and paginate
    allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paginatedLogs = allLogs.slice((page - 1) * perPage, page * perPage);

    return NextResponse.json({
        logs: paginatedLogs,
        pagination: {
            page,
            per_page: perPage,
            total: allLogs.length,
            total_pages: Math.ceil(allLogs.length / perPage),
        }
    });
}
