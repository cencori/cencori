import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { AnalyticsResponse, AnalyticsQuery } from '@/lib/types/audit';

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

// Helper to calculate percentiles
function calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
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
        const query: AnalyticsQuery = {
            timeRange: (searchParams.get('timeRange') as AnalyticsQuery['timeRange']) || '30d',
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
            granularity: (searchParams.get('granularity') as AnalyticsQuery['granularity']) || 'day',
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

        // ============================================
        // 1. Fetch all requests for the time period
        // ============================================
        const { data: requests, error: requestsError } = await supabaseAdmin
            .from('ai_requests')
            .select('*')
            .eq('project_id', projectId)
            .gte('created_at', start)
            .lte('created_at', end);

        if (requestsError) {
            console.error('[Analytics API] Error fetching requests:', requestsError);
            return NextResponse.json(
                { error: 'Failed to fetch analytics data' },
                { status: 500 }
            );
        }

        const allRequests = requests || [];

        // ============================================
        // 2. Calculate Core Metrics
        // ============================================
        const totalRequests = allRequests.length;
        const successfulRequests = allRequests.filter(r => r.status === 'success').length;
        const filteredRequests = allRequests.filter(r => r.status === 'filtered').length;
        const blockedOutputRequests = allRequests.filter(r => r.status === 'blocked_output').length;
        const errorRequests = allRequests.filter(r => r.status === 'error').length;

        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
        const blockRate = totalRequests > 0 ? ((filteredRequests + blockedOutputRequests) / totalRequests) * 100 : 0;

        // Latency metrics
        const latencies = allRequests.map(r => r.latency_ms || 0).filter(l => l > 0);
        const avgLatencyMs = latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
        const p50LatencyMs = calculatePercentile(latencies, 50);
        const p95LatencyMs = calculatePercentile(latencies, 95);
        const p99LatencyMs = calculatePercentile(latencies, 99);

        // Cost and token metrics
        const totalCostUsd = allRequests.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
        const avgCostPerRequest = totalRequests > 0 ? totalCostUsd / totalRequests : 0;
        const totalTokens = allRequests.reduce((sum, r) => sum + (r.total_tokens || 0), 0);
        const avgTokensPerRequest = totalRequests > 0 ? totalTokens / totalRequests : 0;

        // ============================================
        // 3. Time Series Data
        // ============================================
        const timeSeriesMap = new Map<string, {
            success: number;
            filtered: number;
            blocked_output: number;
            errors: number;
        }>();

        allRequests.forEach(req => {
            const timestamp = new Date(req.created_at);
            let key: string;

            // Group by granularity
            if (query.granularity === 'hour') {
                key = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')} ${String(timestamp.getHours()).padStart(2, '0')}:00`;
            } else if (query.granularity === 'week') {
                const weekStart = new Date(timestamp);
                weekStart.setDate(timestamp.getDate() - timestamp.getDay());
                key = weekStart.toISOString().split('T')[0];
            } else {
                // day (default)
                key = timestamp.toISOString().split('T')[0];
            }

            if (!timeSeriesMap.has(key)) {
                timeSeriesMap.set(key, { success: 0, filtered: 0, blocked_output: 0, errors: 0 });
            }

            const bucket = timeSeriesMap.get(key)!;
            if (req.status === 'success') bucket.success++;
            else if (req.status === 'filtered') bucket.filtered++;
            else if (req.status === 'blocked_output') bucket.blocked_output++;
            else if (req.status === 'error') bucket.errors++;
        });

        const timeSeries = Array.from(timeSeriesMap.entries())
            .map(([timestamp, counts]) => ({
                timestamp,
                ...counts,
                total: counts.success + counts.filtered + counts.blocked_output + counts.errors,
            }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        // ============================================
        // 4. Model Usage Breakdown
        // ============================================
        const modelMap = new Map<string, { count: number; totalCost: number; totalLatency: number }>();

        allRequests.forEach(req => {
            const model = req.model || 'unknown';
            if (!modelMap.has(model)) {
                modelMap.set(model, { count: 0, totalCost: 0, totalLatency: 0 });
            }
            const stats = modelMap.get(model)!;
            stats.count++;
            stats.totalCost += req.cost_usd || 0;
            stats.totalLatency += req.latency_ms || 0;
        });

        const modelUsage = Array.from(modelMap.entries())
            .map(([model, stats]) => ({
                model,
                count: stats.count,
                percentage: totalRequests > 0 ? (stats.count / totalRequests) * 100 : 0,
                totalCost: stats.totalCost,
                avgLatency: stats.count > 0 ? stats.totalLatency / stats.count : 0,
            }))
            .sort((a, b) => b.count - a.count);

        // Cost by model
        const costByModel = modelUsage
            .map(m => ({
                model: m.model,
                totalCost: m.totalCost,
                percentage: totalCostUsd > 0 ? (m.totalCost / totalCostUsd) * 100 : 0,
            }))
            .sort((a, b) => b.totalCost - a.totalCost);

        // ============================================
        // 5. Security Summary
        // ============================================
        const { data: incidents } = await supabaseAdmin
            .from('security_incidents')
            .select('incident_type, severity, details')
            .eq('project_id', projectId)
            .gte('created_at', start)
            .lte('created_at', end);

        const securitySummary = {
            jailbreakAttempts: incidents?.filter(i => i.incident_type === 'jailbreak').length || 0,
            piiBlocks: incidents?.filter(i => i.incident_type === 'pii_output' || i.incident_type === 'pii_input').length || 0,
            promptInjections: incidents?.filter(i => i.incident_type === 'prompt_injection').length || 0,
            falsePositives: 0, // TODO: Track this separately
            totalIncidents: incidents?.length || 0,
            criticalIncidents: incidents?.filter(i => i.severity === 'critical').length || 0,
        };

        // ============================================
        // 6. Top Blocked Patterns
        // ============================================
        const patternMap = new Map<string, { count: number; severity: 'low' | 'medium' | 'high' | 'critical' }>();

        incidents?.forEach(incident => {
            const patterns = incident.details?.patterns_detected || [];
            const severity = incident.severity as 'low' | 'medium' | 'high' | 'critical';

            patterns.forEach((pattern: string) => {
                if (!patternMap.has(pattern)) {
                    patternMap.set(pattern, { count: 0, severity });
                }
                const stats = patternMap.get(pattern)!;
                stats.count++;
                // Keep the highest severity
                const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
                if (severityOrder[severity] > severityOrder[stats.severity]) {
                    stats.severity = severity;
                }
            });
        });

        const topBlockedPatterns = Array.from(patternMap.entries())
            .map(([pattern, stats]) => ({
                pattern,
                count: stats.count,
                severity: stats.severity,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10

        // ============================================
        // 7. Build Response
        // ============================================
        const response: AnalyticsResponse = {
            timeRange: {
                start,
                end,
            },
            metrics: {
                totalRequests,
                successfulRequests,
                filteredRequests,
                blockedOutputRequests,
                errorRequests,
                successRate,
                blockRate,
                avgLatencyMs,
                p50LatencyMs,
                p95LatencyMs,
                p99LatencyMs,
                totalCostUsd,
                avgCostPerRequest,
                totalTokens,
                avgTokensPerRequest,
            },
            timeSeries,
            modelUsage,
            securitySummary,
            topBlockedPatterns,
            costByModel,
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('[Analytics API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
