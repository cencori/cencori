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
const MAX_LEXICAL_CANDIDATES = 30;
// Hard cap on stored memory content length
const MAX_CONTENT_CHARS = 2000;

export type MemorySource =
    | 'chat'
    | 'dismiss'
    | 'pr_merged'
    | 'done'
    | 'project_brief'
    | 'scan_summary'
    | 'accepted_risk'
    | 'weak_spot';

export interface MemoryEntry {
    id: string;
    content: string;
    source: MemorySource;
    similarity: number;
    created_at: string;
}

export interface ContinuityMemoryEntry {
    id: string;
    content: string;
    source: MemorySource;
    created_at: string;
    scan_run_id?: string | null;
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

function normalizeToken(token: string): string {
    return token
        .toLowerCase()
        .replace(/[^a-z0-9_/-]/g, "")
        .trim();
}

function extractQueryTokens(query: string): string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    const raw = query.split(/\s+/g);
    for (const part of raw) {
        const token = normalizeToken(part);
        if (!token || token.length < 2 || seen.has(token)) continue;
        seen.add(token);
        tokens.push(token);
        if (tokens.length >= 12) break;
    }
    return tokens;
}

export function formatMemorySourceLabel(source: MemorySource | string): string {
    return source === 'chat' ? 'Past conversation' :
        source === 'dismiss' ? 'Previously dismissed' :
            source === 'pr_merged' ? 'PR merged' :
                source === 'done' ? 'Marked as done' :
                    source === 'project_brief' ? 'Project brief' :
                        source === 'scan_summary' ? 'Prior scan' :
                            source === 'accepted_risk' ? 'Accepted risk' :
                                source === 'weak_spot' ? 'Recurring weak spot' :
                    'Note';
}

function formatMemoryEntries(entries: MemoryEntry[]): string {
    return entries.map((entry) => `- [${formatMemorySourceLabel(entry.source)}] ${entry.content}`).join('\n');
}

async function lexicalSearchMemory(
    projectId: string,
    userId: string,
    query: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
): Promise<MemoryEntry[]> {
    const tokens = extractQueryTokens(query);
    if (tokens.length === 0) return [];

    const { data, error } = await supabase
        .from('scan_chat_memory')
        .select('id, content, source, created_at')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_LEXICAL_CANDIDATES);

    if (error) {
        throw new ScanMemoryError('search_failed', `[Scan Memory] Lexical fallback failed: ${error.message}`);
    }

    if (!Array.isArray(data) || data.length === 0) return [];

    const ranked = data
        .map((row) => {
            const content = typeof row.content === 'string' ? row.content : '';
            const contentLc = content.toLowerCase();
            let matches = 0;
            for (const token of tokens) {
                if (contentLc.includes(token)) matches += 1;
            }
            if (matches === 0) return null;
            return {
                id: String(row.id),
                content,
                source: typeof row.source === 'string' ? row.source : 'chat',
                similarity: matches / tokens.length,
                created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
            } as MemoryEntry;
        })
        .filter((entry): entry is MemoryEntry => entry !== null)
        .sort((a, b) => {
            if (b.similarity !== a.similarity) return b.similarity - a.similarity;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, MAX_RESULTS);

    return ranked;
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
    let semanticSearchError: string | null = null;

    try {
        const embedding = await embedText(query, { enforce: false });
        if (embedding) {
            const { data, error } = await supabase.rpc('match_scan_memory', {
                query_embedding: embedding,
                p_project_id: projectId,
                p_user_id: userId,
                match_threshold: SEARCH_THRESHOLD,
                match_count: MAX_RESULTS,
            });

            if (error) {
                semanticSearchError = error.message;
            } else if (Array.isArray(data) && data.length > 0) {
                const entries = data as MemoryEntry[];
                return formatMemoryEntries(entries);
            }
        }
    } catch (err) {
        semanticSearchError = err instanceof Error ? err.message : String(err);
    }

    try {
        const lexicalEntries = await lexicalSearchMemory(projectId, userId, query, supabase);
        if (lexicalEntries.length > 0) return formatMemoryEntries(lexicalEntries);

        if (semanticSearchError) {
            console.warn(`[Scan Memory] Semantic retrieval failed; lexical fallback returned no matches: ${semanticSearchError}`);
        }
        return '';
    } catch (lexicalErr) {
        const lexicalMessage = lexicalErr instanceof Error ? lexicalErr.message : String(lexicalErr);
        if (enforce) {
            const detail = semanticSearchError
                ? `[Scan Memory] Search failed. Semantic retrieval error: ${semanticSearchError}. Lexical fallback error: ${lexicalMessage}`
                : `[Scan Memory] Search failed. Lexical fallback error: ${lexicalMessage}`;
            throw new ScanMemoryError('search_failed', detail);
        }
        console.warn('[Scan Memory] Search failed:', lexicalMessage);
        return '';
    }
}

export async function getContinuityMemoryContext(
    projectId: string,
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    options?: ScanMemoryOptions,
): Promise<string> {
    const enforce = options?.enforce ?? false;

    try {
        const { data, error } = await supabase
            .from('scan_chat_memory')
            .select('id, content, source, created_at')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .in('source', ['project_brief', 'scan_summary', 'accepted_risk', 'weak_spot'])
            .order('created_at', { ascending: false })
            .limit(12);

        if (error) {
            throw new ScanMemoryError('search_failed', `[Scan Memory] Continuity query failed: ${error.message}`);
        }

        const entries = Array.isArray(data) ? data as MemoryEntry[] : [];
        if (entries.length === 0) return '';

        const grouped: MemoryEntry[] = [];
        const sourceLimits: Partial<Record<MemorySource, number>> = {
            project_brief: 1,
            scan_summary: 2,
            accepted_risk: 2,
            weak_spot: 2,
        };
        const counts = new Map<string, number>();

        for (const entry of entries) {
            const source = entry.source as MemorySource;
            const limit = sourceLimits[source] ?? 0;
            if (limit === 0) continue;
            const nextCount = (counts.get(source) || 0) + 1;
            if (nextCount > limit) continue;
            counts.set(source, nextCount);
            grouped.push(entry);
        }

        return formatMemoryEntries(grouped);
    } catch (err) {
        if (enforce) {
            if (err instanceof ScanMemoryError) throw err;
            throw new ScanMemoryError(
                'search_failed',
                `[Scan Memory] Continuity retrieval failed: ${err instanceof Error ? err.message : String(err)}`
            );
        }
        console.warn('[Scan Memory] Continuity retrieval failed:', err instanceof Error ? err.message : err);
        return '';
    }
}

export async function listContinuityMemoryEntries(
    projectId: string,
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    options?: {
        limit?: number;
    },
): Promise<ContinuityMemoryEntry[]> {
    const limit = Math.max(1, Math.min(options?.limit ?? 12, 24));

    const { data, error } = await supabase
        .from('scan_chat_memory')
        .select('id, content, source, created_at, scan_run_id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .in('source', ['project_brief', 'scan_summary', 'accepted_risk', 'weak_spot'])
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        throw new ScanMemoryError('search_failed', `[Scan Memory] Continuity listing failed: ${error.message}`);
    }

    if (!Array.isArray(data)) {
        return [];
    }

    return data
        .map((row) => ({
            id: String(row.id),
            content: typeof row.content === 'string' ? row.content : '',
            source: typeof row.source === 'string' ? row.source as MemorySource : 'chat',
            created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
            scan_run_id: typeof row.scan_run_id === 'string' ? row.scan_run_id : null,
        }))
        .filter((entry) => entry.content.length > 0);
}

/**
 * Embed (when available) and store a new memory entry.
 * In strict mode, persistence still succeeds without embeddings by storing null vectors.
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
        // Keep memory writes available even if embeddings are unavailable (e.g. rate limits).
        const embedding = await embedText(truncated, { enforce: false });

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

        if (!embedding) {
            console.warn('[Scan Memory] Stored memory without embedding; semantic retrieval will fall back to lexical search.');
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
