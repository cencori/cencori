import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId } = await params;

    try {
        const searchParams = req.nextUrl.searchParams;
        const timeRange = searchParams.get('time_range') || '7d';
        const environment = searchParams.get('environment') || 'production';

        // Calculate time filter
        const now = new Date();
        let startTime: Date;

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
            case '90d':
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Get API keys for this environment (active = not revoked)
        // Legacy keys (NULL environment) are treated as production keys
        let apiKeysQuery = supabaseAdmin
            .from('api_keys')
            .select('id, key_prefix, environment')
            .eq('project_id', projectId)
            .is('revoked_at', null);

        const { data: allApiKeys } = await apiKeysQuery;

        // Filter keys based on environment
        const apiKeys = allApiKeys?.filter(key => {
            if (key.environment) {
                return environment === 'production'
                    ? key.environment === 'production'
                    : key.environment === 'test';
            } else {
                // Legacy keys - check prefix for test
                const isTestKey = key.key_prefix?.includes('_test') || key.key_prefix?.includes('test_');
                return environment === 'production' ? !isTestKey : isTestKey;
            }
        });

        const apiKeyIds = apiKeys?.map(k => k.id) || [];

        // Fetch all requests in time range
        const { data: requests, error: reqError } = await supabaseAdmin
            .from('ai_requests')
            .select('*')
            .eq('project_id', projectId)
            .in('api_key_id', apiKeyIds)
            .gte('created_at', startTime.toISOString());

        if (reqError) {
            console.error('[Analytics API] Error fetching requests:', reqError);
            return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
        }

        // Fetch security incidents
        const { data: incidents, error: incError } = await supabaseAdmin
            .from('security_incidents')
            .select('*')
            .eq('project_id', projectId)
            .in('api_key_id', apiKeyIds)
            .gte('created_at', startTime.toISOString());

        if (incError) {
            console.error('[Analytics API] Error fetching incidents:', incError);
        }

        // Calculate metrics
        const totalRequests = requests?.length || 0;
        const successfulRequests = requests?.filter(r => r.status === 'success').length || 0;
        const filteredRequests = requests?.filter(r => r.status === 'filtered').length || 0;
        const blockedOutputRequests = requests?.filter(r => r.status === 'blocked_output').length || 0;
        const errorRequests = requests?.filter(r => r.status === 'error').length || 0;

        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

        const totalCost = requests?.reduce((sum, r) => sum + (r.cost_usd || 0), 0) || 0;
        const totalTokens = requests?.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0;

        const latencies = requests?.map(r => r.latency_ms).filter(l => l != null) || [];
        const avgLatency = latencies.length > 0
            ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
            : 0;

        const totalIncidents = incidents?.length || 0;
        const criticalIncidents = incidents?.filter(i => i.severity === 'critical').length || 0;

        // Model usage breakdown
        const modelUsage: Record<string, number> = {};
        requests?.forEach(r => {
            modelUsage[r.model] = (modelUsage[r.model] || 0) + 1;
        });

        // Security incidents by severity
        const incidentsBySeverity = {
            critical: incidents?.filter(i => i.severity === 'critical').length || 0,
            high: incidents?.filter(i => i.severity === 'high').length || 0,
            medium: incidents?.filter(i => i.severity === 'medium').length || 0,
            low: incidents?.filter(i => i.severity === 'low').length || 0,
        };

        return NextResponse.json({
            overview: {
                total_requests: totalRequests,
                successful_requests: successfulRequests,
                filtered_requests: filteredRequests,
                blocked_output_requests: blockedOutputRequests,
                error_requests: errorRequests,
                success_rate: Math.round(successRate * 10) / 10, // Round to 1 decimal
                total_cost: totalCost,
                total_tokens: totalTokens,
                avg_latency: Math.round(avgLatency),
                total_incidents: totalIncidents,
                critical_incidents: criticalIncidents,
            },
            breakdown: {
                model_usage: modelUsage,
                incidents_by_severity: incidentsBySeverity,
            },
        });

    } catch (error) {
        console.error('[Analytics API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
