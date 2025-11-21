import { createAdminClient } from '@/lib/supabaseAdmin';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Timestamp when the window resets
}

export async function checkRateLimit(projectId: string): Promise<RateLimitResult> {
    const supabaseAdmin = createAdminClient();
    const now = Date.now();
    const windowStart = new Date(now - RATE_LIMIT_WINDOW).toISOString();

    // Count requests in the current window
    const { count, error } = await supabaseAdmin
        .from('ai_requests')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('created_at', windowStart);

    if (error) {
        console.error('[Rate Limit] Error checking limit:', error);
        // Fail open if DB error, to avoid blocking legitimate traffic due to system issues
        return {
            success: true,
            limit: MAX_REQUESTS_PER_WINDOW,
            remaining: 1,
            reset: now + RATE_LIMIT_WINDOW,
        };
    }

    const currentUsage = count || 0;
    const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - currentUsage);

    return {
        success: currentUsage < MAX_REQUESTS_PER_WINDOW,
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining,
        reset: now + RATE_LIMIT_WINDOW,
    };
}
