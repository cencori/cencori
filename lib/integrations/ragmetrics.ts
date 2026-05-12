/**
 * RagMetrics Integration
 * 
 * Sends AI request/response pairs to the RagMetrics Live Evaluation API
 * for automated quality scoring (faithfulness, hallucination, relevance).
 * 
 * API: POST https://app.ragmetrics.ai/api/v2/evaluate-direct/
 * Auth: Bearer <rm_live_...>
 * Docs: https://ragmetrics.ai/docs
 * 
 * Flow:
 *   1. After a chat completion, fire-and-forget a POST to RagMetrics
 *   2. RagMetrics returns a run_id (202 Accepted) or scores inline (200 OK)
 *   3. If async (202), store run_id and poll later when user views the log
 *   4. Write final scores to ai_requests.evaluation_* columns
 */

import { createAdminClient } from '@/lib/supabaseAdmin';

// ── Types ──

export interface RagMetricsEvalResult {
    score: number;
    details: Record<string, any>;
    status: 'completed' | 'pending' | 'failed';
    runId?: string;
}

export interface RagMetricsConfig {
    criteria?: string[];
    threshold?: number;
    metadata?: Record<string, any>;
}

interface RagMetricsAPIPayload {
    question: string;
    answer: string;
    context?: string[];
    eval_group_id: string;
    metrics?: string[];
}

interface RagMetricsAPIResponse {
    // Synchronous (200)
    evaluation_id?: string;
    status?: string;
    scores?: Record<string, { score: number; explanation?: string }>;
    overall_score?: number;
    // Async (202)
    run_id?: string;
    message?: string;
    // Direct fields (alternative response shape)
    score?: number;
    details?: Record<string, any>;
}

// ── Constants ──

const RAGMETRICS_API_URL = process.env.RAGMETRICS_API_URL
    || 'https://app.ragmetrics.ai/api/v2/evaluate-direct/';

const RAGMETRICS_RESULTS_URL = process.env.RAGMETRICS_RESULTS_URL
    || 'https://app.ragmetrics.ai/api/v2/evaluate-direct/';

const DEFAULT_METRICS = ['faithfulness', 'hallucination', 'relevance'];

const EVAL_TIMEOUT_MS = 15_000; // 15s — generous for LLM-as-judge

// ── Main Evaluation Function ──

/**
 * Send a request/response pair to RagMetrics for evaluation.
 * Called as fire-and-forget from the chat route after logging.
 */
export async function evaluateWithRagMetrics(params: {
    projectId: string;
    requestId: string;
    prompt: string;
    response: string;
    context?: string;
    metadata?: Record<string, any>;
}): Promise<RagMetricsEvalResult> {
    const supabase = createAdminClient();

    try {
        // 1. Fetch RagMetrics config for this project
        const { data: settings, error: settingsError } = await supabase
            .from('project_settings')
            .select('ragmetrics_enabled, ragmetrics_api_key, ragmetrics_config')
            .eq('project_id', params.projectId)
            .single();

        if (settingsError || !settings?.ragmetrics_enabled || !settings?.ragmetrics_api_key) {
            // Silently skip — not enabled or no key
            return { score: 0, details: { reason: 'not_enabled' }, status: 'completed' };
        }

        // 2. Get project slug for auto-generated eval_group_id
        const { data: project } = await supabase
            .from('projects')
            .select('slug')
            .eq('id', params.projectId)
            .single();

        const evalGroupId = `cencori-${project?.slug || params.projectId}`;

        // 3. Build the RagMetrics payload
        const config = (settings.ragmetrics_config as RagMetricsConfig) || {};
        const payload: RagMetricsAPIPayload = {
            question: params.prompt,
            answer: params.response,
            eval_group_id: evalGroupId,
            metrics: config.criteria || DEFAULT_METRICS,
        };

        // Only include context if we actually extracted some
        if (params.context && params.context.trim().length > 0) {
            payload.context = [params.context];
        }

        console.log(`[RagMetrics] Sending evaluation for request ${params.requestId} (group: ${evalGroupId})`);

        // 4. Call RagMetrics API
        const apiResponse = await fetch(RAGMETRICS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.ragmetrics_api_key}`,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(EVAL_TIMEOUT_MS),
        });

        // 5. Handle response based on status code
        if (apiResponse.status === 202) {
            // Async evaluation — store run_id for later polling
            const asyncResult = await apiResponse.json() as RagMetricsAPIResponse;
            const runId = asyncResult.run_id || asyncResult.evaluation_id;

            console.log(`[RagMetrics] Async evaluation started: run_id=${runId}`);

            await supabase
                .from('ai_requests')
                .update({
                    evaluation_status: 'pending',
                    evaluation_details: {
                        run_id: runId,
                        eval_group_id: evalGroupId,
                        submitted_at: new Date().toISOString(),
                    },
                    evaluation_at: new Date().toISOString(),
                })
                .eq('id', params.requestId);

            return {
                score: 0,
                details: { run_id: runId, eval_group_id: evalGroupId },
                status: 'pending',
                runId: runId || undefined,
            };
        }

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`RagMetrics API error (${apiResponse.status}): ${errorText}`);
        }

        // 6. Synchronous evaluation — parse scores
        const result = await apiResponse.json() as RagMetricsAPIResponse;
        const evalResult = parseEvalResponse(result);

        console.log(`[RagMetrics] Evaluation complete: score=${evalResult.score}`);

        // 7. Write scores to the ai_requests row
        await supabase
            .from('ai_requests')
            .update({
                evaluation_status: 'completed',
                evaluation_score: evalResult.score,
                evaluation_details: evalResult.details,
                evaluation_at: new Date().toISOString(),
            })
            .eq('id', params.requestId);

        return evalResult;

    } catch (error) {
        console.error('[RagMetrics] Evaluation failed:', error);

        // Mark as failed so the UI can show the error state
        await supabase
            .from('ai_requests')
            .update({
                evaluation_status: 'failed',
                evaluation_details: { error: error instanceof Error ? error.message : 'Unknown error' },
                evaluation_at: new Date().toISOString(),
            })
            .eq('id', params.requestId)
            .catch(dbErr => console.error('[RagMetrics] Failed to update failure status:', dbErr));

        return {
            score: 0,
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
            status: 'failed',
        };
    }
}

// ── Fetch Async Results ──

/**
 * Poll RagMetrics for the result of an async evaluation.
 * Called when a user opens a log detail that has status='pending'.
 */
export async function fetchRagMetricsResult(params: {
    projectId: string;
    requestId: string;
    runId: string;
}): Promise<RagMetricsEvalResult> {
    const supabase = createAdminClient();

    try {
        const { data: settings } = await supabase
            .from('project_settings')
            .select('ragmetrics_api_key')
            .eq('project_id', params.projectId)
            .single();

        if (!settings?.ragmetrics_api_key) {
            return { score: 0, details: { reason: 'no_api_key' }, status: 'failed' };
        }

        const resultUrl = `${RAGMETRICS_RESULTS_URL}${params.runId}/`;

        const apiResponse = await fetch(resultUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${settings.ragmetrics_api_key}`,
            },
            signal: AbortSignal.timeout(10_000),
        });

        if (!apiResponse.ok) {
            if (apiResponse.status === 404 || apiResponse.status === 202) {
                // Still processing
                return { score: 0, details: { reason: 'still_processing' }, status: 'pending' };
            }
            throw new Error(`RagMetrics poll error (${apiResponse.status})`);
        }

        const result = await apiResponse.json() as RagMetricsAPIResponse;
        const evalResult = parseEvalResponse(result);

        // Persist the final result
        await supabase
            .from('ai_requests')
            .update({
                evaluation_status: 'completed',
                evaluation_score: evalResult.score,
                evaluation_details: evalResult.details,
                evaluation_at: new Date().toISOString(),
            })
            .eq('id', params.requestId);

        return evalResult;

    } catch (error) {
        console.error('[RagMetrics] Polling failed:', error);
        return {
            score: 0,
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
            status: 'failed',
        };
    }
}

// ── Helpers ──

/**
 * Parse the RagMetrics API response into our normalized format.
 * Handles both the `scores` object shape and the flat `score` shape.
 */
function parseEvalResponse(result: RagMetricsAPIResponse): RagMetricsEvalResult {
    // Shape 1: { scores: { faithfulness: { score, explanation }, ... }, overall_score }
    if (result.scores && typeof result.scores === 'object') {
        const overallScore = result.overall_score
            ?? Object.values(result.scores).reduce((sum, m) => sum + (m.score || 0), 0)
                / Math.max(Object.keys(result.scores).length, 1);

        return {
            score: Math.round(overallScore * 100) / 100,
            details: {
                evaluation_id: result.evaluation_id,
                metrics: result.scores,
                overall_score: result.overall_score,
            },
            status: 'completed',
        };
    }

    // Shape 2: { score, details }
    if (typeof result.score === 'number') {
        return {
            score: result.score,
            details: result.details || result,
            status: 'completed',
        };
    }

    // Fallback: treat entire response as details
    return {
        score: 0,
        details: result as Record<string, any>,
        status: 'completed',
    };
}

/**
 * Extract context from conversation messages for RAG evaluation.
 * Looks for system messages that contain retrieved context.
 */
export function extractRAGContext(messages: any[]): string {
    const contextMessages = messages.filter(m =>
        m.role === 'system' && (
            m.content.toLowerCase().includes('context') ||
            m.content.toLowerCase().includes('retrieved') ||
            m.content.toLowerCase().includes('document') ||
            m.content.toLowerCase().includes('source')
        )
    );

    if (contextMessages.length > 0) {
        return contextMessages.map(m => m.content).join('\n\n');
    }

    return '';
}
