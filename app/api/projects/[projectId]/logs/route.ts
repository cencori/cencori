import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId } = await params;

    try {
        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const perPage = parseInt(searchParams.get('per_page') || '50');
        const status = searchParams.get('status'); // 'success' | 'filtered' | 'blocked_output' | 'error' | null
        const model = searchParams.get('model');
        const timeRange = searchParams.get('time_range') || '24h'; // '1h' | '24h' | '7d' | '30d' | 'all'
        const search = searchParams.get('search');
        const environment = searchParams.get('environment') || 'production'; // 'production' | 'test'

        // Calculate time filter
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

        // Get API keys for this environment (active = not revoked)
        const { data: apiKeys } = await supabaseAdmin
            .from('api_keys')
            .select('id')
            .eq('project_id', projectId)
            .eq('environment', environment)
            .is('revoked_at', null);

        const apiKeyIds = apiKeys?.map(k => k.id) || [];

        // If no API keys found for environment, return empty results
        if (apiKeyIds.length === 0) {
            return NextResponse.json({
                requests: [],
                pagination: {
                    page,
                    per_page: perPage,
                    total: 0,
                    total_pages: 0,
                },
            });
        }

        // Build query
        let query = supabaseAdmin
            .from('ai_requests')
            .select('*', { count: 'exact' })
            .eq('project_id', projectId)
            .in('api_key_id', apiKeyIds);

        // Apply filters
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
            // Search in request payload content (first message)
            query = query.or(`error_message.ilike.%${search}%,request_payload->>messages->>0->>content.ilike.%${search}%`);
        }

        // Apply pagination
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

        // Format response with request preview
        const formattedRequests = requests?.map(req => {
            // Extract first message content for preview
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

            return {
                id: req.id,
                created_at: req.created_at,
                status: req.status,
                model: req.model,
                prompt_tokens: req.prompt_tokens,
                completion_tokens: req.completion_tokens,
                total_tokens: req.total_tokens,
                cost_usd: req.cost_usd,
                latency_ms: req.latency_ms,
                safety_score: req.safety_score,
                error_message: req.error_message,
                filtered_reasons: req.filtered_reasons,
                request_preview: requestPreview,
            };
        }) || [];

        return NextResponse.json({
            requests: formattedRequests,
            pagination: {
                page,
                per_page: perPage,
                total: count || 0,
                total_pages: Math.ceil((count || 0) / perPage),
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
