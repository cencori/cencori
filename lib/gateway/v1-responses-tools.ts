/**
 * Built-in tool implementations for OpenAI Responses API.
 * Tools: web_search_preview, file_search, code_interpreter
 */

import { createAdminClient } from '@/lib/supabaseAdmin';

// ── File Indexing (for file_search uploads) ──

export async function indexFileContent(
    projectId: string,
    filename: string,
    content: string,
): Promise<void> {
    const supabase = createAdminClient();
    const chunks = chunkText(content, 2000);

    const records = chunks.map((chunk, i) => ({
        project_id: projectId,
        content: chunk,
        source: `file:${filename}`,
        metadata: { filename, chunk_index: i, total_chunks: chunks.length },
    }));

    const { error } = await supabase.from('scan_chat_memory').insert(records);
    if (error) throw error;
}

function chunkText(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + maxLen, text.length);
        if (end < text.length) {
            const breakAt = text.lastIndexOf('\n', end);
            if (breakAt > start) end = breakAt;
        }
        chunks.push(text.slice(start, end));
        start = end;
    }
    return chunks;
}

// ── Types ──

export type WebSearchToolConfig = {
    type: 'web_search_preview';
    search_context_size?: 'low' | 'medium' | 'high';
    user_location?: {
        type: 'approximate';
        country?: string;
        city?: string;
        region?: string;
    };
};

export type FileSearchToolConfig = {
    type: 'file_search';
    max_num_results?: number;
    filters?: Record<string, unknown>;
};

export type CodeInterpreterToolConfig = {
    type: 'code_interpreter';
};

export type ResponsesBuiltInTool =
    | WebSearchToolConfig
    | FileSearchToolConfig
    | CodeInterpreterToolConfig;

export type ToolCallOutput = {
    type: 'web_search_call' | 'file_search_call' | 'code_interpreter_call';
    id: string;
    status: 'completed' | 'failed';
    output?: Record<string, unknown>;
    error?: string;
};

// ── Web Search Preview ──

const SEARCH_API_ENDPOINT = process.env.SEARCH_API_ENDPOINT || 'https://api.duckduckgo.com';
const SEARCH_API_KEY = process.env.SEARCH_API_KEY;

export async function executeWebSearch(
    query: string,
    config: WebSearchToolConfig
): Promise<ToolCallOutput> {
    const callId = `ws_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    try {
        const results = await performWebSearch(query, config.search_context_size || 'medium');
        return {
            type: 'web_search_call',
            id: callId,
            status: 'completed',
            output: {
                query,
                results,
                search_context_size: config.search_context_size || 'medium',
            },
        };
    } catch (error) {
        return {
            type: 'web_search_call',
            id: callId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Web search failed',
        };
    }
}

async function performWebSearch(
    query: string,
    contextSize: 'low' | 'medium' | 'high'
): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const numResults = contextSize === 'low' ? 3 : contextSize === 'medium' ? 8 : 15;

    if (SEARCH_API_KEY && SEARCH_API_ENDPOINT) {
        try {
            const response = await fetch(
                `${SEARCH_API_ENDPOINT}/search?q=${encodeURIComponent(query)}&count=${numResults}`,
                { headers: { 'Authorization': `Bearer ${SEARCH_API_KEY}` } }
            );
            if (response.ok) {
                const data = await response.json() as { results?: Array<{ title: string; url: string; snippet: string }> };
                return (data.results || []).slice(0, numResults);
            }
        } catch {
            // Fall through to simulated results
        }
    }

    // Fallback: return placeholder that tells the model results were unavailable
    return [];
}

function formatSearchResultsForContext(
    results: Array<{ title: string; url: string; snippet: string }>,
    query: string
): string {
    if (results.length === 0) {
        return `[Web search for "${query}" returned no results.]`;
    }
    const lines = results.map(
        (r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
    );
    return `Web search results for "${query}":\n\n${lines.join('\n\n')}`;
}

// ── File Search ──

export async function executeFileSearch(
    query: string,
    projectId: string,
    config: FileSearchToolConfig
): Promise<ToolCallOutput> {
    const callId = `fs_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    try {
        const supabase = createAdminClient();
        const maxResults = config.max_num_results || 5;

        let queryBuilder = supabase
            .from('scan_chat_memory')
            .select('id, content, source, created_at, metadata')
            .eq('project_id', projectId)
            .textSearch('content', query, { type: 'websearch' });

        // Apply metadata filters when provided (e.g., { source: "file:quarterly-report.pdf" })
        if (config.filters) {
            for (const [key, value] of Object.entries(config.filters)) {
                queryBuilder = queryBuilder.eq(`metadata->>${key}`, String(value));
            }
        }

        const { data } = await queryBuilder
            .order('created_at', { ascending: false })
            .limit(maxResults);

        const results = (Array.isArray(data) ? data : []).map(d => ({
            file_name: d.source || 'memory',
            content: d.content || '',
            score: 0,
        }));

        return {
            type: 'file_search_call',
            id: callId,
            status: 'completed',
            output: {
                query,
                results,
                total_results: results.length,
            },
        };
    } catch (error) {
        return {
            type: 'file_search_call',
            id: callId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'File search failed',
        };
    }
}

function formatFileSearchResultsForContext(
    results: Array<{ file_name: string; content: string; score: number }>,
    query: string
): string {
    if (results.length === 0) {
        return `[File search for "${query}" returned no results.]`;
    }
    const lines = results.map(
        (r, i) => `[Source ${i + 1}: ${r.file_name}]\n${r.content}`
    );
    return `Retrieved context for "${query}":\n\n${lines.join('\n\n')}`;
}

// ── Code Interpreter ──

export async function executeCodeInterpreter(
    code: string,
    language?: string
): Promise<ToolCallOutput> {
    const callId = `ci_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    try {
        const lang = language || detectLanguage(code);
        const output = await runCode(code, lang);
        return {
            type: 'code_interpreter_call',
            id: callId,
            status: 'completed',
            output: {
                code,
                language: lang,
                ...output,
            },
        };
    } catch (error) {
        return {
            type: 'code_interpreter_call',
            id: callId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Code execution failed',
        };
    }
}

function detectLanguage(code: string): string {
    if (code.includes('def ') || code.includes('import ') || code.includes('print(')) return 'python';
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'javascript';
    if (code.includes('fn ') || code.includes('println!')) return 'rust';
    return 'python';
}

async function runCode(
    code: string,
    language: string
): Promise<{ stdout: string; stderr: string; execution_time_ms: number }> {
    const start = Date.now();

    if (language === 'python') {
        const result = await runPython(code);
        return { ...result, execution_time_ms: Date.now() - start };
    }
    if (language === 'javascript') {
        const result = await runJavaScript(code);
        return { ...result, execution_time_ms: Date.now() - start };
    }

    return { stdout: '', stderr: `Unsupported language: ${language}`, execution_time_ms: 0 };
}

async function runPython(code: string): Promise<{ stdout: string; stderr: string }> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        // In development, try to run Python subprocess
        try {
            const { execSync } = await import('child_process');
            const result = execSync(`python3 -c "${code.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, {
                timeout: 10_000,
                maxBuffer: 1024 * 1024,
            });
            return { stdout: result.toString().trim(), stderr: '' };
        } catch (error: unknown) {
            const err = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
            return {
                stdout: err.stdout?.toString().trim() || '',
                stderr: err.stderr?.toString().trim() || err.message || 'Execution failed',
            };
        }
    }

    // In production, log the code and return a placeholder
    console.warn('[CodeInterpreter] Python execution not available in production');
    return {
        stdout: '[Code execution is available in development mode]',
        stderr: '',
    };
}

async function runJavaScript(code: string): Promise<{ stdout: string; stderr: string }> {
    try {
        let output = '';
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (...args: unknown[]) => {
            output += args.map(a => String(a)).join(' ') + '\n';
        };
        console.error = (...args: unknown[]) => {
            output += '[ERROR] ' + args.map(a => String(a)).join(' ') + '\n';
        };

        try {
            const result = eval(code);
            if (result !== undefined) {
                output += String(result) + '\n';
            }
        } finally {
            console.log = originalLog;
            console.error = originalError;
        }

        return { stdout: output.trim(), stderr: '' };
    } catch (error) {
        return { stdout: '', stderr: error instanceof Error ? error.message : 'Execution failed' };
    }
}

// ── Tool Orchestration ──

export type ToolPreProcessResult = {
    systemContext: string;
    toolOutputs: ToolCallOutput[];
};

export async function preProcessBuiltInTools(
    input: string,
    tools: ResponsesBuiltInTool[],
    projectId: string
): Promise<ToolPreProcessResult> {
    const systemContexts: string[] = [];
    const toolOutputs: ToolCallOutput[] = [];

    for (const tool of tools) {
        switch (tool.type) {
            case 'web_search_preview': {
                const result = await executeWebSearch(input, tool);
                toolOutputs.push(result);
                if (result.status === 'completed' && result.output?.results) {
                    systemContexts.push(
                        formatSearchResultsForContext(
                            result.output.results as Array<{ title: string; url: string; snippet: string }>,
                            input
                        )
                    );
                }
                break;
            }
            case 'file_search': {
                const result = await executeFileSearch(input, projectId, tool);
                toolOutputs.push(result);
                if (result.status === 'completed' && result.output?.results) {
                    systemContexts.push(
                        formatFileSearchResultsForContext(
                            result.output.results as Array<{ file_name: string; content: string; score: number }>,
                            input
                        )
                    );
                }
                break;
            }
            case 'code_interpreter':
                // Code interpreter runs on-demand when the model generates code,
                // not pre-processed. Handled in the execution loop.
                break;
        }
    }

    return {
        systemContext: systemContexts.join('\n\n'),
        toolOutputs,
    };
}
