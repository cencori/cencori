/**
 * Scan Chat Memory — RAG persistence layer
 *
 * Provides two operations:
 *   searchMemory — embed a query, find top-k relevant past memories for a project
 *   writeMemory  — embed and store a new memory entry
 *
 * Uses Gemini text-embedding-004 (768-dim), consistent with the semantic cache.
 * In best-effort mode, failures are swallowed so the chat/scan feature still works.
 * In strict mode, callers can opt into hard failures for enforcement paths.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMS = 768;
const SEARCH_THRESHOLD = 0.65;
const MAX_RESULTS = 5;
// Hard cap on stored memory content length
const MAX_CONTENT_CHARS = 2000;

export type MemorySource = 'chat' | 'dismiss' | 'pr_merged' | 'done';

export interface MemoryEntry {
    id: string;
    content: string;
    source: MemorySource;
    similarity: number;
    created_at: string;
}

export type ScanMemoryErrorCode =
    | 'missing_embedding_key'
    | 'embedding_failed'
    | 'embedding_unavailable'
    | 'search_failed'
    | 'write_failed';

export class ScanMemoryError extends Error {
    code: ScanMemoryErrorCode;

    constructor(code: ScanMemoryErrorCode, message: string) {
        super(message);
        this.name = 'ScanMemoryError';
        this.code = code;
    }
}

export interface ScanMemoryOptions {
    enforce?: boolean;
}

async function embedText(text: string, options?: ScanMemoryOptions): Promise<number[] | null> {
    const enforce = options?.enforce ?? false;
    const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
        const message = '[Scan Memory] No API key configured for embeddings';
        if (enforce) {
            throw new ScanMemoryError('missing_embedding_key', message);
        }
        console.warn(`${message} — skipping embedding`);
        return null;
    }

    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
        const result = await model.embedContent(text.slice(0, 8000));
        const values = result.embedding?.values;
        if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) return null;
        return values;
    } catch (err) {
        if (enforce) {
            throw new ScanMemoryError(
                'embedding_failed',
                `[Scan Memory] Embedding failed: ${err instanceof Error ? err.message : String(err)}`
            );
        }
        console.warn('[Scan Memory] Embedding failed:', err instanceof Error ? err.message : err);
        return null;
    }
}

/**
 * Search for relevant past memories for a project + user, given a query string.
 * Returns formatted text snippets suitable for injection into a system prompt.
 */
export async function searchMemory(
    projectId: string,
    userId: string,
    query: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    options?: ScanMemoryOptions,
): Promise<string> {
    const enforce = options?.enforce ?? false;
    try {
        const embedding = await embedText(query, { enforce });
        if (!embedding) {
            if (enforce) {
                throw new ScanMemoryError('embedding_unavailable', '[Scan Memory] Embedding is required in strict mode');
            }
            return '';
        }

        const { data, error } = await supabase.rpc('match_scan_memory', {
            query_embedding: embedding,
            p_project_id: projectId,
            p_user_id: userId,
            match_threshold: SEARCH_THRESHOLD,
            match_count: MAX_RESULTS,
        });

        if (error) {
            if (enforce) {
                throw new ScanMemoryError('search_failed', `[Scan Memory] Search failed: ${error.message}`);
            }
            return '';
        }
        if (!Array.isArray(data) || data.length === 0) return '';

        const entries = data as MemoryEntry[];
        const lines = entries.map(entry => {
            const sourceLabel =
                entry.source === 'chat' ? 'Past conversation' :
                    entry.source === 'dismiss' ? 'Previously dismissed' :
                        entry.source === 'pr_merged' ? 'PR merged' :
                            entry.source === 'done' ? 'Marked as done' :
                                'Note';
            return `- [${sourceLabel}] ${entry.content}`;
        });

        return lines.join('\n');
    } catch (err) {
        if (enforce) {
            if (err instanceof ScanMemoryError) throw err;
            throw new ScanMemoryError(
                'search_failed',
                `[Scan Memory] Search failed: ${err instanceof Error ? err.message : String(err)}`
            );
        }
        console.warn('[Scan Memory] Search failed:', err instanceof Error ? err.message : err);
        return '';
    }
}

/**
 * Embed and store a new memory entry. Fire-and-forget — do not await the result
 * in latency-sensitive paths (e.g. after a streaming response completes).
 */
export async function writeMemory(
    projectId: string,
    userId: string,
    content: string,
    source: MemorySource,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    scanRunId?: string,
    options?: ScanMemoryOptions,
): Promise<void> {
    const enforce = options?.enforce ?? false;
    try {
        const truncated = content.slice(0, MAX_CONTENT_CHARS);
        const embedding = await embedText(truncated, { enforce });
        if (enforce && !embedding) {
            throw new ScanMemoryError('embedding_unavailable', '[Scan Memory] Embedding is required in strict mode');
        }

        const { error } = await supabase
            .from('scan_chat_memory')
            .insert({
                project_id: projectId,
                user_id: userId,
                content: truncated,
                source,
                embedding,
                ...(scanRunId ? { scan_run_id: scanRunId } : {}),
            });

        if (error) {
            if (enforce) {
                throw new ScanMemoryError('write_failed', `[Scan Memory] Write failed: ${error.message}`);
            }
            console.warn('[Scan Memory] Write failed:', error.message);
        }
    } catch (err) {
        if (enforce) {
            if (err instanceof ScanMemoryError) throw err;
            throw new ScanMemoryError(
                'write_failed',
                `[Scan Memory] Write error: ${err instanceof Error ? err.message : String(err)}`
            );
        }
        console.warn('[Scan Memory] Write error:', err instanceof Error ? err.message : err);
    }
}
