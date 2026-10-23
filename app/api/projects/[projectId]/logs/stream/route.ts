import { NextRequest } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isBetterAuthEnabled } from '@/lib/auth/flags';

// After the RFC-0001 cutover there is no Supabase Realtime: the same stream is
// fed by polling the project's newest requests (index project_id, created_at).
const POLL_INTERVAL_MS = 3000;
const POLL_COLUMNS =
    'id, created_at, status, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, safety_score, error_message, filtered_reasons, first_message:request_payload->messages->0';

type RequestRow = Record<string, unknown> & { id: string; created_at: string };
type FirstMessage = { content?: unknown; text?: unknown } | null | undefined;

function formatRequest(req: RequestRow, firstMessage: FirstMessage) {
    const text = firstMessage?.content || firstMessage?.text;
    const requestPreview = typeof text === 'string' ? text.substring(0, 100) : '';
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
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const projectAccess = await requireProjectAccess(projectId);
    if (!projectAccess.ok) return projectAccess.response;
    const supabaseAdmin = createAdminClient();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const data = `data: ${JSON.stringify({ type: 'connected', project_id: projectId })}\n\n`;
            controller.enqueue(encoder.encode(data));

            const send = (req: RequestRow, firstMessage: FirstMessage) => {
                try {
                    const data = `data: ${JSON.stringify({
                        type: 'new_request',
                        request: formatRequest(req, firstMessage),
                    })}\n\n`;
                    controller.enqueue(encoder.encode(data));
                } catch (error) {
                    console.error('[SSE] Error formatting request:', error);
                }
            };

            let stopListening: () => void;
            if (isBetterAuthEnabled()) {
                // Rows at the newest timestamp already sent are skipped by id,
                // so two requests in the same microsecond are both delivered.
                let since = new Date().toISOString();
                let sentAtSince = new Set<string>();
                let polling = false;
                const poll = setInterval(async () => {
                    if (polling) return;
                    polling = true;
                    try {
                        const { data: rows, error } = await supabaseAdmin
                            .from('ai_requests')
                            .select(POLL_COLUMNS)
                            .eq('project_id', projectId)
                            .gte('created_at', since)
                            .order('created_at', { ascending: true })
                            .limit(100);
                        if (error) {
                            console.error('[SSE] Poll error:', error.message);
                            return;
                        }
                        for (const row of (rows ?? []) as RequestRow[]) {
                            if (row.created_at === since && sentAtSince.has(row.id)) continue;
                            if (row.created_at !== since) {
                                since = row.created_at;
                                sentAtSince = new Set();
                            }
                            sentAtSince.add(row.id);
                            send(row, row.first_message as FirstMessage);
                        }
                    } finally {
                        polling = false;
                    }
                }, POLL_INTERVAL_MS);
                stopListening = () => clearInterval(poll);
            } else {
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
                        (payload) => send(
                            payload.new as RequestRow,
                            (payload.new as { request_payload?: { messages?: FirstMessage[] } }).request_payload?.messages?.[0],
                        ),
                    )
                    .subscribe();
                stopListening = () => { channel.unsubscribe(); };
            }

            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch (error) {
                    console.error('[SSE] Heartbeat error:', error);
                    clearInterval(heartbeat);
                }
            }, 30000);

            req.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
                stopListening();
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
