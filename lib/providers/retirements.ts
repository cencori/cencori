/**
 * When a vendor will stop serving a model, as the vendor announced it.
 *
 * Read from the vendors' own deprecation pages on 2026-11-23:
 *   OpenAI     https://developers.openai.com/api/docs/deprecations
 *   Anthropic  https://platform.claude.com/docs/en/about-claude/model-deprecations
 *   Google     https://ai.google.dev/gemini-api/docs/deprecations
 *
 * Only a date the page states for the exact model ID is here. A model with no entry has no
 * announced date; that is not a promise it will stay. Google calls its dates the earliest
 * possible and Anthropic calls this one tentative, so treat each as "no later than planned".
 * /v1/models returns these as `retires_at` and `replaced_by`.
 */
export interface ModelRetirement {
    /** The day the vendor stops serving it (YYYY-MM-DD). */
    date: string;
    /** What the vendor says to use instead. */
    replacedBy?: string;
}

export const MODEL_RETIREMENTS: Record<string, ModelRetirement> = {
    // OpenAI
    'gpt-5.3-chat-latest': { date: '2026-08-10', replacedBy: 'gpt-5.6-sol' },
    'o1': { date: '2026-10-23', replacedBy: 'gpt-5.6-sol' },
    'o3-mini': { date: '2026-10-23', replacedBy: 'gpt-5.6-sol' },
    'o4-mini': { date: '2026-10-23', replacedBy: 'gpt-5.6-terra' },
    'gpt-image-1': { date: '2026-10-23' },
    'gpt-image-1-mini': { date: '2026-12-01' },
    'gpt-image-1.5': { date: '2026-12-01' },
    'gpt-5': { date: '2026-12-11', replacedBy: 'gpt-6.1-sol' },
    'gpt-5-mini': { date: '2026-12-11' },
    'gpt-5-nano': { date: '2026-12-11', replacedBy: 'gpt-6-luna' },
    'gpt-5-pro': { date: '2026-12-11', replacedBy: 'gpt-6.1-sol' },
    'o3': { date: '2026-12-11', replacedBy: 'gpt-6.1-sol' },
    'gpt-5.4-nano': { date: '2027-04-01', replacedBy: 'gpt-6-luna' },
    'gpt-5.1': { date: '2027-04-01', replacedBy: 'gpt-6-sol' },
    // Anthropic
    'claude-sonnet-4-5': { date: '2026-11-30', replacedBy: 'claude-sonnet-5-5' },
    // Google
    'gemini-2.5-pro': { date: '2026-12-01' },
    'gemini-2.5-flash': { date: '2026-12-01' },
};

export function modelRetirement(modelId: string): ModelRetirement | null {
    return MODEL_RETIREMENTS[modelId] ?? null;
}
