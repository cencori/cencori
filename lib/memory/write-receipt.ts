/**
 * Write receipts — the confirmed-written signal behind chat's
 * `memory.write_request_id`. Chat writeback runs after the response flushes
 * and logs one `memory/writeback` row under the chat request id; this module
 * reads that row back. Lives in lib (not the route module) because Next.js
 * route files may only export handlers.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** Gateway request ids are UUIDs; bound the shape before querying. */
export function isValidWriteRequestId(value: string): boolean {
    return /^[A-Za-z0-9-]{8,64}$/.test(value);
}

export interface WriteReceipt {
    requestId: string;
    status: 'pending' | 'success' | 'error';
    extracted: number | null;
    written: number | null;
    scope: string | null;
    error: string | null;
    finishedAt: string | null;
}

export async function fetchWriteReceipt(
    supabase: SupabaseAdmin,
    projectId: string,
    requestId: string
): Promise<WriteReceipt> {
    const { data, error } = await supabase
        .from('ai_requests')
        .select('status, metadata, error_message, created_at')
        .eq('project_id', projectId)
        .eq('request_id', requestId)
        .eq('endpoint', 'memory/writeback')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        return {
            requestId,
            status: 'pending',
            extracted: null,
            written: null,
            scope: null,
            error: null,
            finishedAt: null,
        };
    }

    const metadata = (data.metadata ?? {}) as {
        extracted?: unknown;
        written?: unknown;
        scope?: unknown;
    };
    return {
        requestId,
        status: data.status === 'success' ? 'success' : 'error',
        extracted: typeof metadata.extracted === 'number' ? metadata.extracted : null,
        written: typeof metadata.written === 'number' ? metadata.written : null,
        scope: typeof metadata.scope === 'string' ? metadata.scope : null,
        error: typeof data.error_message === 'string' ? data.error_message : null,
        finishedAt: data.created_at,
    };
}
