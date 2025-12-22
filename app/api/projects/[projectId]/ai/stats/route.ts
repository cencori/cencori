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

        // Group by date for chart
        const requestsByDate = requests?.reduce((acc: DateAggregationMap, r) => {
            const date = new Date(r.created_at).toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = { date, count: 0, cost: 0, tokens: 0 };
            }
            acc[date].count += 1;
            acc[date].cost += parseFloat(r.cost_usd || '0');
            acc[date].tokens += r.total_tokens || 0;
            return acc;
        }, {} as DateAggregationMap);

        // Find first request date to start chart 2 days before
        let firstRequestDate: Date | null = null;
        if (requests && requests.length > 0) {
            const sortedByDate = [...requests].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            firstRequestDate = new Date(sortedByDate[0].created_at);
        }

        // Generate chart data with filled dates (2 days before first request to now)
        const chartData: DateAggregation[] = [];
        if (firstRequestDate) {
            const chartStartDate = new Date(firstRequestDate);
            chartStartDate.setDate(chartStartDate.getDate() - 2);
            const endDate = new Date();

            for (let d = new Date(chartStartDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                // Format as "Dec 22" style
                const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const existing = requestsByDate?.[dateStr];
                chartData.push({
                    date: formattedDate,
                    count: existing?.count || 0,
                    cost: existing?.cost || 0,
                    tokens: existing?.tokens || 0,
                });
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
