import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; requestId: string }> }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId, requestId } = await params;

    try {
        // Fetch the specific request
        const { data: request, error } = await supabaseAdmin
            .from('ai_requests')
            .select('*')
            .eq('id', requestId)
            .eq('project_id', projectId) // Ensure user can only access their project's requests
            .single();

        if (error || !request) {
            return NextResponse.json(
                { error: 'Request not found' },
                { status: 404 }
            );
        }

        // Fetch associated API key info
        let apiKeyInfo = null;
        if (request.api_key_id) {
            const { data: keyData } = await supabaseAdmin
                .from('api_keys')
                .select('name, environment')
                .eq('id', request.api_key_id)
                .single();

            if (keyData) {
                apiKeyInfo = {
                    name: keyData.name,
                    environment: keyData.environment,
                };
            }
        }

        // Fetch related security incidents (if any)
        const { data: incidents } = await supabaseAdmin
            .from('security_incidents')
            .select('id, incident_type, severity, risk_score, details')
            .eq('ai_request_id', requestId);

        // Format detailed response
        const detailedResponse = {
            // Basic info
            id: request.id,
            created_at: request.created_at,
            status: request.status,
            model: request.model,

            // Payloads (full, not truncated)
            request_payload: request.request_payload,
            response_payload: request.response_payload,

            // Metrics
            prompt_tokens: request.prompt_tokens,
            completion_tokens: request.completion_tokens,
            total_tokens: request.total_tokens,
            cost_usd: request.cost_usd,
            latency_ms: request.latency_ms,

            // Security
            safety_score: request.safety_score,
            error_message: request.error_message,
            filtered_reasons: request.filtered_reasons,

            // Related data
            api_key: apiKeyInfo,
            security_incidents: incidents || [],
        };

        return NextResponse.json(detailedResponse);

    } catch (error) {
        console.error('[Request Detail API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
