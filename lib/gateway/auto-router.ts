/**
 * BYOK-only Auto Router.
 *
 * `auto` / `cencori-auto` resolves to a concrete provider+model based on the
 * task (vision / code / reasoning / fast for chat; embed for embeddings;
 * image for image generation; speech for text-to-speech), routed ONLY across
 * the project's active BYOK keys. There is no managed-credit fallback:
 * without at least one usable BYOK key the request fails closed with 402
 * `byok_required`.
 */

export type AutoTask = 'vision' | 'code' | 'reasoning' | 'fast' | 'embed' | 'image' | 'speech';

export const AUTO_MODEL_IDS = new Set(['auto', 'cencori-auto', 'cencori/auto']);

/** True for `auto`, `cencori-auto`, `cencori/auto` (case-insensitive). */
export function isAutoRouterModel(model: string | null | undefined): boolean {
    if (!model) return false;
    const normalized = model.trim().toLowerCase();
    if (AUTO_MODEL_IDS.has(normalized)) return true;
    // `cencori/auto` may arrive without the slash stripped by callers.
    if (normalized === 'cencori-auto' || normalized === 'auto') return true;
    return false;
}

export const BYOK_REQUIRED_CODE = 'byok_required';
export const BYOK_REQUIRED_STATUS = 402;

export class ByokRequiredError extends Error {
    readonly code = BYOK_REQUIRED_CODE;
    readonly status = BYOK_REQUIRED_STATUS;
    constructor(message?: string) {
        super(
            message ??
                'Auto-router requires a BYOK key. Add your own OpenAI, Anthropic, or Google key in project settings to use `auto`.',
        );
        this.name = 'ByokRequiredError';
    }
}

export function isByokRequiredError(error: unknown): boolean {
    if (error instanceof ByokRequiredError) return true;
    if (error instanceof Error) {
        return (
            error.message.includes('BYOK key') ||
            (error as { code?: unknown }).code === BYOK_REQUIRED_CODE
        );
    }
    return false;
}

// ── Task classification ──────────────────────────────────────────

export interface AutoClassifyInput {
    /** Combined prompt text (all message contents joined). */
    text?: string | null;
    tools?: unknown[] | null;
    hasImage?: boolean;
}

const CODE_SIGNALS = [
    '```',
    'function',
    'class ',
    'import ',
    'export ',
    'const ',
    'debug',
    'refactor',
    'traceback',
    'stack trace',
    'fix bug',
    'code review',
    'write code',
    'implement',
    'console.log',
    'print(',
    'npm ',
    'pip ',
    'git ',
    'docker',
    'kubernetes',
    'sql',
    'api endpoint',
    '.py',
    '.js',
    '.ts',
    'typescript',
    'python',
    'rust',
];

const REASONING_SIGNALS = [
    'step by step',
    'think through',
    'analyze deeply',
    'reason',
    'prove',
    'theorem',
    'mathemat',
    'logic puzzle',
    'compare and contrast',
    'evaluate',
    'research',
    'multi-step',
    'complex problem',
    'strategy',
    'architecture decision',
    'plan carefully',
];

export function classifyAutoTask(input: AutoClassifyInput): AutoTask {
    if (input.hasImage) return 'vision';
    const text = (input.text ?? '').toLowerCase();
    const hasTools = Array.isArray(input.tools) && input.tools.length > 0;

    const hasCode = CODE_SIGNALS.some((s) => text.includes(s));
    const hasReasoning =
        (input.text ?? '').length > 2000 ||
        REASONING_SIGNALS.some((s) => text.includes(s));

    // Tool calls need a tool-capable frontier model. Reasoning wins when the
    // prompt is explicitly analytical; otherwise code is the agentic default.
    if (hasTools) return hasReasoning && !hasCode ? 'reasoning' : 'code';
    if (hasCode) return 'code';
    if (hasReasoning) return 'reasoning';
    return 'fast';
}

// ── Ranked candidates per task ───────────────────────────────────
// Ordered by preference for the task (quality for code/reasoning/vision,
// cost for fast). Resolution intersects with the project's active BYOK set
// and verifies pricing, so over-listing is safe — unpriced or unkeyed
// entries are skipped.

export interface AutoCandidate {
    provider: string;
    model: string;
}

// Every entry must exist in the vision analyzer's VISION_MODELS map
// (lib/vision/analyze.ts) — an unknown id fails as `Unknown vision model`
// instead of falling through to the next candidate. `claude-haiku-4-5` is
// deliberately absent: it is not vision-capable (the chat vision router
// upgrades it to Sonnet), so listing it would route images to a model that
// cannot see them.
const VISION_CANDIDATES: AutoCandidate[] = [
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'google', model: 'gemini-2.5-flash' },
    { provider: 'google', model: 'gemini-2.5-flash-lite' },
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'maximo', model: 'maximo-atlas-1.2' },
];

const CODE_CANDIDATES: AutoCandidate[] = [
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'anthropic', model: 'claude-opus-5' },
    { provider: 'openai', model: 'gpt-5.4-mini' },
    { provider: 'openai', model: 'gpt-5.4' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'google', model: 'gemini-3.5-flash' },
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
    { provider: 'google', model: 'gemini-2.5-flash' },
    { provider: 'xai', model: 'grok-4.6' },
    { provider: 'mistral', model: 'codestral-latest' },
    { provider: 'mistral', model: 'devstral-latest' },
    { provider: 'deepseek', model: 'deepseek-v4-pro' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'cerebras', model: 'gpt-oss-120b' },
    // Late fallbacks so single-provider BYOK setups (cohere/maximo-only)
    // serve code tasks degraded rather than 402.
    { provider: 'cohere', model: 'command-r-plus-08-2024' },
    { provider: 'maximo', model: 'maximo-atlas-1.2' },
];

const REASONING_CANDIDATES: AutoCandidate[] = [
    { provider: 'anthropic', model: 'claude-opus-5' },
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'openai', model: 'o3' },
    { provider: 'openai', model: 'gpt-5.5' },
    { provider: 'openai', model: 'gpt-5.4' },
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
    { provider: 'google', model: 'gemini-2.5-pro' },
    { provider: 'xai', model: 'grok-4.7' },
    { provider: 'xai', model: 'grok-4.6' },
    { provider: 'deepseek', model: 'deepseek-v4-pro' },
    // Late fallbacks so single-provider BYOK setups serve reasoning tasks
    // degraded rather than 402 (best available, not best in class).
    { provider: 'mistral', model: 'mistral-large-latest' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'cerebras', model: 'gpt-oss-120b' },
    { provider: 'cohere', model: 'command-r-plus-08-2024' },
    { provider: 'maximo', model: 'maximo-atlas-1.2' },
];

const FAST_CANDIDATES: AutoCandidate[] = [
    { provider: 'google', model: 'gemini-2.5-flash-lite' },
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'anthropic', model: 'claude-haiku-4-5' },
    { provider: 'google', model: 'gemini-2.5-flash' },
    { provider: 'openai', model: 'gpt-5.4-nano' },
    { provider: 'mistral', model: 'mistral-small-latest' },
    { provider: 'mistral', model: 'ministral-8b' },
    { provider: 'groq', model: 'openai/gpt-oss-20b' },
    // Late fallbacks so single-provider BYOK setups (xai/deepseek/cerebras/
    // cohere/maximo-only) serve fast tasks rather than 402. Validation-only
    // callers (e.g. session approve) resolve without task signals and land
    // here, so every chat-capable provider needs at least one entry.
    { provider: 'xai', model: 'grok-4.5' },
    { provider: 'deepseek', model: 'deepseek-v4-pro' },
    { provider: 'cerebras', model: 'gpt-oss-120b' },
    { provider: 'cohere', model: 'command-r-plus-08-2024' },
    { provider: 'maximo', model: 'maximo-atlas-1.2' },
];

// ── Non-chat modalities ──────────────────────────────────────────
// Endpoint-implied tasks: the route (not text signals) decides. Ordered by
// preference (cost for embed, quality for image, latency for speech).
// Resolution intersects with the project's active BYOK set and verifies
// pricing per modality, so over-listing is safe.

const EMBED_CANDIDATES: AutoCandidate[] = [
    { provider: 'openai', model: 'text-embedding-3-small' },
    { provider: 'openai', model: 'text-embedding-3-large' },
    { provider: 'google', model: 'text-embedding-004' },
    { provider: 'cohere', model: 'embed-english-v3.0' },
    { provider: 'cohere', model: 'embed-multilingual-v3.0' },
];

const IMAGE_CANDIDATES: AutoCandidate[] = [
    { provider: 'openai', model: 'gpt-image-1' },
    { provider: 'openai', model: 'dall-e-3' },
    { provider: 'openai', model: 'dall-e-2' },
    { provider: 'google', model: 'gemini-3-pro-image' },
    { provider: 'google', model: 'imagen-3' },
];

const SPEECH_CANDIDATES: AutoCandidate[] = [
    { provider: 'openai', model: 'tts-1' },
    { provider: 'openai', model: 'tts-1-hd' },
    { provider: 'deepgram', model: 'aura-asteria-en' },
    { provider: 'cartesia', model: 'sonic-2' },
    { provider: 'spitch', model: 'spitch-tts' },
    { provider: 'elevenlabs', model: 'eleven_turbo_v2_5' },
];

export function candidatesForTask(task: AutoTask): AutoCandidate[] {
    switch (task) {
        case 'vision':
            return VISION_CANDIDATES;
        case 'code':
            return CODE_CANDIDATES;
        case 'reasoning':
            return REASONING_CANDIDATES;
        case 'embed':
            return EMBED_CANDIDATES;
        case 'image':
            return IMAGE_CANDIDATES;
        case 'speech':
            return SPEECH_CANDIDATES;
        case 'fast':
        default:
            return FAST_CANDIDATES;
    }
}

import type { createAdminClient } from '@/lib/supabaseAdmin';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// ── BYOK inventory ───────────────────────────────────────────────

export interface ByokInventory {
    /** Lowercased provider names with at least one usable key. */
    providers: Set<string>;
    /** Dashboard default_model per provider (lowercased key), when set. */
    defaultModels: Map<string, string>;
}

/**
 * All usable BYOK providers for a project: active `provider_keys` rows plus
 * active non-proxy `provider_connections`. Never throws — empty means "no
 * BYOK", which the caller turns into a 402.
 */
export async function getActiveByokInventory(
    supabase: SupabaseAdmin,
    projectId: string,
): Promise<ByokInventory> {
    const providers = new Set<string>();
    const defaultModels = new Map<string, string>();
    try {
        const { data } = await supabase
            .from('provider_keys')
            .select('provider, is_active, default_model')
            .eq('project_id', projectId)
            .eq('is_active', true);
        for (const row of (data ?? []) as Array<{
            provider?: string;
            is_active?: boolean;
            default_model?: string | null;
        }>) {
            const name = String(row?.provider ?? '').trim().toLowerCase();
            if (!name) continue;
            providers.add(name);
            if (row?.default_model) defaultModels.set(name, String(row.default_model));
        }
    } catch {
        // Fall through to embedded below.
    }
    try {
        const { data } = await supabase
            .from('provider_connections')
            .select('provider, status, base_url')
            .eq('project_id', projectId)
            .eq('status', 'active');
        for (const row of (data ?? []) as Array<{
            provider?: string;
            status?: string;
            base_url?: string | null;
        }>) {
            if ((row?.base_url ?? null) !== null) continue; // proxy-bound: not BYOK
            const name = String(row?.provider ?? '').trim().toLowerCase();
            if (!name) continue;
            providers.add(name);
        }
    } catch {
        // Empty inventory fails closed downstream.
    }
    return { providers, defaultModels };
}

export function formatByokSetupHint(providers: Set<string>): string {
    if (providers.size === 0) {
        return 'Add your own OpenAI, Anthropic, or Google key in project settings to use `auto`.';
    }
    return `Available BYOK providers: ${[...providers].sort().join(', ')}.`;
}

// ── Generic modality resolver ────────────────────────────────────
// Shared by the non-chat routes (embeddings / images / audio), which own
// their provider dispatch and pricing tables. Intersects the task candidate
// list with the project's active BYOK inventory, then asks the caller to
// verify each candidate (pricing row, format support, key presence).
// Returns the first verifiable candidate; fails closed with 402 otherwise.
// BYOK-only: never falls back to a managed key.

export async function resolveAutoModelForTask(args: {
    supabase: SupabaseAdmin;
    projectId: string;
    task: AutoTask;
    /** Return normally when the candidate is usable; throw to skip it. */
    verify?: (provider: string, model: string) => Promise<unknown>;
}): Promise<{ provider: string; model: string; task: AutoTask }> {
    const inventory = await getActiveByokInventory(args.supabase, args.projectId);
    if (inventory.providers.size === 0) {
        throw new ByokRequiredError(
            `Auto-router requires a BYOK key. ${formatByokSetupHint(inventory.providers)}`,
        );
    }
    const ranked = candidatesForTask(args.task).filter((c) =>
        inventory.providers.has(c.provider.toLowerCase()),
    );
    let lastError: unknown = null;
    for (const candidate of ranked) {
        const provider = candidate.provider.toLowerCase();
        try {
            if (args.verify) await args.verify(provider, candidate.model);
            return { provider, model: candidate.model, task: args.task };
        } catch (error) {
            if (error instanceof ByokRequiredError) throw error;
            lastError = error;
            continue;
        }
    }
    const detail = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
    throw new ByokRequiredError(
        `Auto-router found BYOK key(s) for [${[...inventory.providers].sort().join(', ')}] but no priced, allowed model for '${args.task}' tasks.${detail} ${formatByokSetupHint(inventory.providers)}`,
    );
}
