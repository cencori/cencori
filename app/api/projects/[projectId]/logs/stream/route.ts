import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Server-Sent Events endpoint for real-time log updates
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const supabaseAdmin = createAdminClient();

    //  Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Send initial connection message
            const data = `data: ${JSON.stringify({ type: 'connected', project_id: projectId })}\n\n`;
            controller.enqueue(encoder.encode(data));

            // Set up realtime subscription
            const channel = supabaseAdmin
                .channel(`logs_${projectId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'ai_requests',
                        filter: `project_id=eq.${projectId}`,
                    },
                    (payload) => {
                        try {
                            // Format the new request
                            const req = payload.new;
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

                            const formattedRequest = {
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

                            // Send to client
                            const data = `data: ${JSON.stringify({
                                type: 'new_request',
                                request: formattedRequest,
                            })}\n\n`;

                            controller.enqueue(encoder.encode(data));
                        } catch (error) {
                            console.error('[SSE] Error formatting request:', error);
                        }
                    }
                )
                .subscribe();

            // Keep connection alive with heartbeat
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch (error) {
                    console.error('[SSE] Heartbeat error:', error);
                    clearInterval(heartbeat);
                }
            }, 30000); // Every 30 seconds

            // Cleanup on close
            req.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
                channel.unsubscribe();
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
    });
}
