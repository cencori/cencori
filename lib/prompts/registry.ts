import { createAdminClient } from '@/lib/supabaseAdmin';
import type { ResolvedPrompt } from './types';

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Extract variable names from a prompt template
 */
export function extractVariableNames(template: string): string[] {
    const names = new Set<string>();
    for (const match of template.matchAll(VARIABLE_PATTERN)) {
        names.add(match[1]);
    }
    return Array.from(names);
}

/**
 * Interpolate {{variable}} placeholders in a template
 */
export function interpolateVariables(
    template: string,
    variables: Record<string, string>,
    strict = true
): string {
    return template.replace(VARIABLE_PATTERN, (match, name) => {
        if (name in variables) {
            return variables[name];
        }
        if (strict) {
            throw new Error(`Missing required variable: {{${name}}}`);
        }
        return match;
    });
}

/**
 * Generate a URL-safe slug from a prompt name
 */
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Resolve a named prompt to its active version content
 */
export async function resolvePrompt(
    projectId: string,
    promptName: string,
    variables?: Record<string, string>
): Promise<ResolvedPrompt | null> {
    const supabase = createAdminClient();

    // Lookup by name or slug
    const { data: prompt } = await supabase
        .from('prompt_registry')
        .select('id, name, active_version_id')
        .eq('project_id', projectId)
        .or(`name.eq.${promptName},slug.eq.${promptName}`)
        .single();

    if (!prompt || !prompt.active_version_id) {
        return null;
    }

    // Get active version
    const { data: version } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('id', prompt.active_version_id)
        .single();

    if (!version) {
        return null;
    }

    // Interpolate variables
    let content = version.content;
    if (variables && Object.keys(variables).length > 0) {
        try {
            content = interpolateVariables(version.content, variables);
        } catch (error) {
            throw error; // Re-throw to let the gateway return a 400
        }
    }

    return {
        content,
        rawContent: version.content,
        modelHint: version.model_hint,
        temperature: version.temperature ? parseFloat(String(version.temperature)) : null,
        maxTokens: version.max_tokens,
        promptId: prompt.id,
        versionId: version.id,
        version: version.version,
        promptName: prompt.name,
    };
}

/**
 * Log prompt usage (fire-and-forget)
 */
export async function logPromptUsage(params: {
    projectId: string;
    promptId: string;
    versionId: string;
    model: string;
    apiKeyId?: string;
    requestId?: string;
    variablesUsed?: Record<string, string> | null;
    latencyMs?: number;
}): Promise<void> {
    try {
        const supabase = createAdminClient();
        await supabase.from('prompt_usage_log').insert({
            project_id: params.projectId,
            prompt_id: params.promptId,
            version_id: params.versionId,
            model: params.model,
            api_key_id: params.apiKeyId || null,
            request_id: params.requestId || null,
            variables_used: params.variablesUsed || null,
            latency_ms: params.latencyMs || null,
        });
    } catch (error) {
        console.error('[Prompts] Usage logging failed:', error);
    }
}
