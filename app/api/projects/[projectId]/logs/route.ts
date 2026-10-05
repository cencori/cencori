import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getProjectTier } from '@/lib/require-tier-feature';
import { clampTimeRange, LOG_RETENTION_RANGE } from '@/lib/entitlements';
import { mapIncidentTypeToStatus, incidentReasons } from '@/lib/security-incident-log';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId } = await params;
    const projectAccess = await requireProjectAccess(projectId);
    if (!projectAccess.ok) return projectAccess.response;

    try {
        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const perPage = parseInt(searchParams.get('per_page') || '20');
        const status = searchParams.get('status');
        const model = searchParams.get('model');
        // History depth is tier-gated: free 7d, pro 30d, team 90d, enterprise all.
        // Surface the clamp so the UI can tell "no rows (filtered)" apart from
        // "no rows (retention limit)" instead of silently narrowing the window.
        const tier = (await getProjectTier(projectId)) || 'free';
        const requestedTimeRange = searchParams.get('time_range') || '24h';
        const timeRange = clampTimeRange(tier, requestedTimeRange);
        const tierMax = LOG_RETENTION_RANGE[tier] ?? LOG_RETENTION_RANGE.free;
        const search = searchParams.get('search');
        // Environments retired — one key, production. No environment filtering;
        // all rows for the project are returned. The param is accepted for
        // backward compat and ignored.
        const apiKeyId = searchParams.get('api_key_id');

        let startTime: Date | null = null;
        const now = new Date();

        switch (timeRange) {
            case '1h':
                startTime = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'all':
                startTime = null;
                break;
        }

        // Key names are display-only. Fetch all keys (including revoked) so
        // rows tied to a rotated key still resolve. Filtering is by
        // project + environment on ai_requests itself — never by key list —
        // so playground (null key), revoked-key, and embedded-run rows stay
        // visible.
        const { data: allApiKeys } = await supabaseAdmin
            .from('api_keys')
            .select('id, name, key_prefix, environment')
            .eq('project_id', projectId);

        const apiKeyMap: Record<string, { name: string; prefix: string }> = {};
        allApiKeys?.forEach(k => {
            apiKeyMap[k.id] = { name: k.name, prefix: k.key_prefix };
        });

        let query = supabaseAdmin
            .from('ai_requests')
            .select('*', { count: 'exact' })
            .eq('project_id', projectId);

        if (apiKeyId && apiKeyId !== 'all') {
            query = query.eq('api_key_id', apiKeyId);
        }

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (model && model !== 'all') {
            query = query.eq('model', model);
        }

        if (startTime) {
            query = query.gte('created_at', startTime.toISOString());
        }

        if (search) {
            // PostgREST `or` splits on commas, and `->>` returns text while
            // `->` traverses JSON — the old
            // `request_payload->>messages->>0->>content` chain was invalid and
            // made search fail closed. Sanitize + use the correct traversal.
            const sanitized = search.replace(/[,%()"]/g, ' ').trim().slice(0, 100);
            if (sanitized) {
                const escaped = sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_');
                query = query.or(`error_message.ilike.%${escaped}%,request_payload->messages->0->>content.ilike.%${escaped}%`);
            }
        }

        const offset = (page - 1) * perPage;
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + perPage - 1);

        const { data: requests, error, count } = await query;

        if (error) {
            console.error('[Logs API] Error fetching requests:', error);
            return NextResponse.json(
                { error: 'Failed to fetch request logs' },
                { status: 500 }
            );
        }

        const formattedRequests = requests?.map(req => {
            let requestPreview = '';
            try {
                const messages = req.request_payload?.messages;
                if (messages && messages.length > 0) {
                    const firstMessage = messages[0];
                    requestPreview = (firstMessage.content || firstMessage.text || '').substring(0, 100);
                }
            } catch (e) {
                requestPreview = '';
            }

            const keyInfo = req.api_key_id ? apiKeyMap[req.api_key_id] : undefined;

            return {
                id: req.id,
                created_at: req.created_at,
                status: req.status,
                model: req.model,
                provider: req.provider,
                environment: req.environment,
                api_key_id: req.api_key_id,
                api_key_name: keyInfo?.name || (req.api_key_id ? 'Unknown' : 'No key'),
                api_key_prefix: keyInfo?.prefix || (req.api_key_id ? 'unknown' : 'no-key'),
                prompt_tokens: req.prompt_tokens,
                completion_tokens: req.completion_tokens,
                total_tokens: req.total_tokens,
                cost_usd: req.cost_usd,
                latency_ms: req.latency_ms,
                safety_score: req.safety_score,
                error_message: req.error_message,
                filtered_reasons: req.filtered_reasons,
                request_preview: requestPreview,
                source: 'ai_request' as const,
            };
        }) || [];

        const shouldIncludeSecurityIncidents =
            !status || status === 'all' ||
            ['filtered', 'blocked_output', 'rate_limited', 'blocked'].includes(status);

        let securityIncidents: any[] = [];

        if (shouldIncludeSecurityIncidents) {
            let incidentsQuery = supabaseAdmin
                .from('security_incidents')
                .select('*')
                .eq('project_id', projectId);

            if (startTime) {
                incidentsQuery = incidentsQuery.gte('created_at', startTime.toISOString());
            }

            if (status && status !== 'all') {
                if (status === 'filtered') {
                    incidentsQuery = incidentsQuery.in('incident_type', ['content_filter', 'jailbreak', 'prompt_injection', 'pii_input', 'data_rule_mask', 'data_rule_redact', 'data_rule_tokenize']);
                } else if (status === 'blocked_output' || status === 'blocked') {
                    incidentsQuery = incidentsQuery.in('incident_type', ['output_leakage', 'pii_output', 'data_rule_block']);
                } else if (status === 'rate_limited') {
                    incidentsQuery = incidentsQuery.eq('incident_type', 'rate_limit_exceeded');
                }
            }

            const { data: incidents } = await incidentsQuery
                .order('created_at', { ascending: false })
                .limit(perPage);

            securityIncidents = (incidents || []).map(incident => ({
                id: incident.id,
                created_at: incident.created_at,
                status: mapIncidentTypeToStatus(incident.incident_type, incident.action_taken),
                model: '—',
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                cost_usd: 0,
                latency_ms: 0,
                safety_score: incident.risk_score,
                error_message: incident.description,
                filtered_reasons: incidentReasons(incident),
                request_preview: incident.input_text?.substring(0, 100) || incident.description || '',
                source: 'security_incident' as const,
            }));
        }

        const allLogs = [...formattedRequests, ...securityIncidents]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, perPage);
        const totalWithIncidents = (count || 0) + securityIncidents.length;

        return NextResponse.json({
            requests: allLogs,
            pagination: {
                page,
                per_page: perPage,
                total: totalWithIncidents,
                total_pages: Math.ceil(totalWithIncidents / perPage),
            },
            meta: {
                requested_time_range: requestedTimeRange,
                applied_time_range: timeRange,
                tier,
                tier_max_time_range: tierMax,
                time_range_clamped: requestedTimeRange !== timeRange,
            },
        });

    } catch (error) {
        console.error('[Logs API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
