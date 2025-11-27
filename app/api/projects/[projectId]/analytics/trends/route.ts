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
        let groupBy: 'hour' | 'day' = 'day';

        switch (timeRange) {
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                groupBy = 'hour';
                break;
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                groupBy = 'day';
                break;
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                groupBy = 'day';
                break;
            case '90d':
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                groupBy = 'day';
                break;
            default:
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                groupBy = 'day';
        }

        // Get API keys for this environment
        const { data: apiKeys } = await supabaseAdmin
            .from('api_keys')
            .select('id')
            .eq('project_id', projectId)
            .eq('environment', environment)
            .eq('is_active', true);

        const apiKeyIds = apiKeys?.map(k => k.id) || [];

        // Fetch requests
        const { data: requests, error } = await supabaseAdmin
            .from('ai_requests')
            .select('created_at, status, cost_usd, latency_ms')
            .eq('project_id', projectId)
            .in('api_key_id', apiKeyIds)
            .gte('created_at', startTime.toISOString())
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[Trends API] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
        }

        // Group data by time period
        const trendData: Record<string, {
            timestamp: string;
            total: number;
            success: number;
            filtered: number;
            blocked_output: number;
            error: number;
            cost: number;
            avg_latency: number;
            latencies: number[];
        }> = {};

        requests?.forEach(req => {
            const date = new Date(req.created_at);
            let key: string;

            if (groupBy === 'hour') {
                // Group by hour
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
            } else {
                // Group by day
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }

            if (!trendData[key]) {
                trendData[key] = {
                    timestamp: key,
                    total: 0,
                    success: 0,
                    filtered: 0,
                    blocked_output: 0,
                    error: 0,
                    cost: 0,
                    avg_latency: 0,
                    latencies: [],
                };
            }

            trendData[key].total++;
            if (req.status === 'success') trendData[key].success++;
            if (req.status === 'filtered') trendData[key].filtered++;
            if (req.status === 'blocked_output') trendData[key].blocked_output++;
            if (req.status === 'error') trendData[key].error++;

            trendData[key].cost += req.cost_usd || 0;
            if (req.latency_ms) {
                trendData[key].latencies.push(req.latency_ms);
            }
        });

        // Calculate averages and format response
        const trends = Object.values(trendData).map(data => ({
            timestamp: data.timestamp,
            total: data.total,
            success: data.success,
            filtered: data.filtered,
            blocked_output: data.blocked_output,
            error: data.error,
            success_rate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
            cost: Math.round(data.cost * 1000000) / 1000000, // Round to 6 decimals
            avg_latency: data.latencies.length > 0
                ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length)
                : 0,
        }));

        return NextResponse.json({ trends, group_by: groupBy });

    } catch (error) {
        console.error('[Trends API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
