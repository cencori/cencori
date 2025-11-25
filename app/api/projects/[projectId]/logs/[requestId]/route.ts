import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { RequestLogDetail } from '@/lib/types/audit';

export async function GET(
    req: NextRequest,
    { params }: { params: { projectId: string; requestId: string } }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId, requestId } = params;

    try {
        // Fetch the specific request with full details
        const { data: request, error } = await supabaseAdmin
            .from('ai_requests')
            .select('*')
            .eq('id', requestId)
            .eq('project_id', projectId)
            .single();

        if (error || !request) {
            return NextResponse.json(
                { error: 'Request not found' },
                { status: 404 }
            );
        }

        // Transform to response format
        const requestDetail: RequestLogDetail = {
            id: request.id,
            created_at: request.created_at,
            status: request.status,
            model: request.model,
            prompt_tokens: request.prompt_tokens || 0,
            completion_tokens: request.completion_tokens || 0,
            total_tokens: request.total_tokens || 0,
            cost_usd: request.cost_usd || 0,
            latency_ms: request.latency_ms || 0,
            safety_score: request.safety_score,
            error_message: request.error_message,
            filtered_reasons: request.filtered_reasons,
            request_preview: request.request_payload?.messages?.[0]?.content?.substring(0, 100) || '',
            request_payload: request.request_payload || {},
            response_payload: request.response_payload,
            api_key_id: request.api_key_id,
            environment: request.api_key_id?.startsWith('cen_test_') ? 'test' : 'production',
        };

        return NextResponse.json(requestDetail);

    } catch (error) {
        console.error('[Request Detail API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
