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
        let groupBy: '10min' | 'hour' | 'day' = 'day';

        switch (timeRange) {
            case '1h':
                startTime = new Date(now.getTime() - 60 * 60 * 1000);
                groupBy = '10min'; // Use 10-minute intervals for last hour
                break;
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

        // Generate all time buckets for the range (including empty ones)
        const generateAllBuckets = () => {
            const buckets: Record<string, {
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

            const current = new Date(startTime);
            const end = new Date(now);

            if (groupBy === '10min') {
                // 10-minute intervals for last hour
                while (current <= end) {
                    const minutes = Math.floor(current.getMinutes() / 10) * 10;
                    const key = `${String(current.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    buckets[key] = {
                        timestamp: key,
                        total: 0, success: 0, filtered: 0, blocked_output: 0, error: 0, cost: 0, avg_latency: 0, latencies: []
                    };
                    current.setMinutes(current.getMinutes() + 10);
                }
            } else if (groupBy === 'hour') {
                // Hourly buckets
                current.setMinutes(0, 0, 0);
                while (current <= end) {
                    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} ${String(current.getHours()).padStart(2, '0')}:00`;
                    buckets[key] = {
                        timestamp: key,
                        total: 0, success: 0, filtered: 0, blocked_output: 0, error: 0, cost: 0, avg_latency: 0, latencies: []
                    };
                    current.setHours(current.getHours() + 1);
                }
            } else {
                // Daily buckets
                current.setHours(0, 0, 0, 0);
                while (current <= end) {
                    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                    buckets[key] = {
                        timestamp: key,
                        total: 0, success: 0, filtered: 0, blocked_output: 0, error: 0, cost: 0, avg_latency: 0, latencies: []
                    };
                    current.setDate(current.getDate() + 1);
                }
            }

            return buckets;
        };

        // Start with all buckets pre-filled with zeros
        const trendData = generateAllBuckets();

        requests?.forEach(req => {
            const date = new Date(req.created_at);
            let key: string;

            if (groupBy === '10min') {
                const minutes = Math.floor(date.getMinutes() / 10) * 10;
                key = `${String(date.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            } else if (groupBy === 'hour') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }

            if (!trendData[key]) {
                trendData[key] = {
                    timestamp: key,
                    total: 0, success: 0, filtered: 0, blocked_output: 0, error: 0, cost: 0, avg_latency: 0, latencies: []
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

        // Calculate averages and format response (sorted by timestamp)
        const trends = Object.values(trendData)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            .map(data => ({
                timestamp: data.timestamp,
                total: data.total,
                success: data.success,
                filtered: data.filtered,
                blocked_output: data.blocked_output,
                error: data.error,
                success_rate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
                cost: Math.round(data.cost * 1000000) / 1000000,
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
