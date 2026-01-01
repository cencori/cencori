import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Aggregated data types
interface DateAggregation {
    date: string;
    count: number;
    cost: number;
    tokens: number;
}

interface ModelAggregation {
    model: string;
    count: number;
    cost: number;
}

type DateAggregationMap = Record<string, DateAggregation>;
type ModelAggregationMap = Record<string, ModelAggregation>;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { projectId } = await params;
        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || '7d'; // 1h, 24h, 7d, 30d, all

        // Verify user has access to project
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, organization_id')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Verify user is member of organization
        const { data: member, error: memberError } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', project.organization_id)
            .eq('user_id', user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Calculate date range
        const now = new Date();
        let startDate: Date;

        if (period === '1h') {
            startDate = new Date(now.getTime() - 60 * 60 * 1000);
        } else if (period === '24h') {
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (period === '30d') {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (period === 'all') {
            startDate = new Date(0); // Beginning of time
        } else {
            // Default to 7d
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Get environment from query params (production or test)
        const environment = searchParams.get('environment') || 'production';

        // Get aggregate stats using admin client, filtered by environment
        const { data: requests, error: requestsError } = await supabaseAdmin
            .from('ai_requests')
            .select(`
                *,
                api_keys!inner(environment)
            `)
            .eq('project_id', projectId)
            .eq('api_keys.environment', environment)
            .gte('created_at', startDate.toISOString());

        if (requestsError) {
            console.error('[AI Stats] Error fetching requests:', requestsError);
            return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
        }

        // Calculate stats
        const totalRequests = requests?.length || 0;
        const successfulRequests = requests?.filter(r => r.status === 'success').length || 0;
        const errorRequests = requests?.filter(r => r.status === 'error').length || 0;
        const filteredRequests = requests?.filter(r => r.status === 'filtered').length || 0;

        const totalCost = requests?.reduce((sum, r) => sum + (parseFloat(r.cost_usd) || 0), 0) || 0;
        const totalTokens = requests?.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0;
        const avgLatency = totalRequests > 0
            ? requests.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / totalRequests
            : 0;

        // Determine grouping granularity based on period
        const getGroupKey = (dateStr: string): string => {
            const d = new Date(dateStr);
            if (period === '1h') {
                // Group by 5-minute intervals
                const minutes = Math.floor(d.getMinutes() / 5) * 5;
                return `${d.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else if (period === '24h') {
                // Group by hour
                return `${d.getHours().toString().padStart(2, '0')}:00`;
            } else {
                // Group by day
                return d.toISOString().split('T')[0];
            }
        };

        // Group requests by the appropriate time unit
        const requestsByTime = requests?.reduce((acc: DateAggregationMap, r) => {
            const key = getGroupKey(r.created_at);
            if (!acc[key]) {
                acc[key] = { date: key, count: 0, cost: 0, tokens: 0 };
            }
            acc[key].count += 1;
            acc[key].cost += parseFloat(r.cost_usd || '0');
            acc[key].tokens += r.total_tokens || 0;
            return acc;
        }, {} as DateAggregationMap);

        // Generate chart data with filled time slots
        const chartData: DateAggregation[] = [];

        if (period === '1h') {
            // Generate 12 slots (every 5 minutes for the last hour)
            for (let i = 11; i >= 0; i--) {
                const slotTime = new Date(now.getTime() - i * 5 * 60 * 1000);
                const minutes = Math.floor(slotTime.getMinutes() / 5) * 5;
                const key = `${slotTime.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                const existing = requestsByTime?.[key];
                chartData.push({
                    date: key,
                    count: existing?.count || 0,
                    cost: existing?.cost || 0,
                    tokens: existing?.tokens || 0,
                });
            }
        } else if (period === '24h') {
            // Generate 24 slots (every hour for the last 24 hours)
            for (let i = 23; i >= 0; i--) {
                const slotTime = new Date(now.getTime() - i * 60 * 60 * 1000);
                const key = `${slotTime.getHours().toString().padStart(2, '0')}:00`;
                const existing = requestsByTime?.[key];
                chartData.push({
                    date: key,
                    count: existing?.count || 0,
                    cost: existing?.cost || 0,
                    tokens: existing?.tokens || 0,
                });
            }
        } else {
            // For 7d, 30d, all - group by day (using UTC dates consistently)
            let firstRequestDate: Date | null = null;
            if (requests && requests.length > 0) {
                const sortedByDate = [...requests].sort((a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                firstRequestDate = new Date(sortedByDate[0].created_at);
                console.log('[AI Stats] First request date:', sortedByDate[0].created_at);
                console.log('[AI Stats] RequestsByTime keys:', Object.keys(requestsByTime || {}));
            }

            // Get today's UTC date
            const now = new Date();
            const todayUTC = now.toISOString().split('T')[0];
            console.log('[AI Stats] Today UTC:', todayUTC, 'Server time:', now.toISOString());

            if (firstRequestDate) {
                // Start 2 days before first request
                const startTs = firstRequestDate.getTime() - (2 * 24 * 60 * 60 * 1000);
                // End at today (current UTC date)
                const endTs = now.getTime();

                // Iterate day by day using milliseconds (avoids timezone issues)
                const msPerDay = 24 * 60 * 60 * 1000;
                for (let ts = startTs; ts <= endTs; ts += msPerDay) {
                    const d = new Date(ts);
                    const dateStr = d.toISOString().split('T')[0];
                    // Format as "Dec 22" style
                    const formattedDate = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC'
                    });
                    const existing = requestsByTime?.[dateStr];
                    chartData.push({
                        date: formattedDate,
                        count: existing?.count || 0,
                        cost: existing?.cost || 0,
                        tokens: existing?.tokens || 0,
                    });
                }

                // Ensure today is included (in case loop didn't reach it exactly)
                const lastEntry = chartData[chartData.length - 1];
                const todayFormatted = new Date(todayUTC + 'T12:00:00Z').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC'
                });
                if (lastEntry?.date !== todayFormatted) {
                    const existing = requestsByTime?.[todayUTC];
                    chartData.push({
                        date: todayFormatted,
                        count: existing?.count || 0,
                        cost: existing?.cost || 0,
                        tokens: existing?.tokens || 0,
                    });
                }

                console.log('[AI Stats] Chart data dates:', chartData.map(c => c.date));
            }
        }

        // Group by model
        const requestsByModel = requests?.reduce((acc: ModelAggregationMap, r) => {
            const model = r.model || 'unknown';
            if (!acc[model]) {
                acc[model] = { model, count: 0, cost: 0 };
            }
            acc[model].count += 1;
            acc[model].cost += parseFloat(r.cost_usd || '0');
            return acc;
        }, {} as ModelAggregationMap);

        return NextResponse.json({
            stats: {
                totalRequests,
                successfulRequests,
                errorRequests,
                filteredRequests,
                totalCost: totalCost.toFixed(6),
                totalTokens,
                avgLatency: Math.round(avgLatency),
            },
            chartData,
            modelBreakdown: Object.values(requestsByModel || {}),
            period,
        });
    } catch (error) {
        console.error('[AI Stats] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
