/**
 * Cencori's free-model catalog — RETIRED 2026-09-23.
 *
 * There is no free tier. Every entry was removed along with the catalog rows
 * that advertised them, so this set is intentionally empty and both predicates
 * below permanently return false:
 *
 * - pricing falls through to the database lookup, which fails closed — a model
 *   without an active model_pricing row returns 503 `pricing_unavailable`
 *   instead of billing zero;
 * - branding never relabels a provider as Cencori, so every row shows its real
 *   vendor.
 *
 * The module stays (rather than being deleted) because pricing.ts, branding.ts,
 * model-access.ts and model-registry.ts all branch on these predicates, and the
 * client bundle imports them — see client-safety.test.ts. Keep it that way: no
 * DB, no env, no Node built-ins.
 *
 * Removed 2026-09-23 (26 catalog rows + 2 audio models):
 *  - Groq free developer plan: groq/compound, groq/compound-mini (404 upstream),
 *    openai/gpt-oss-safeguard-20b, qwen/qwen3.8-27b, qwen/qwen3.6-27b (404),
 *    allam-2-7b, whisper-large-v3, whisper-large-v3-turbo. NOTE: Groq Whisper
 *    transcription now needs model_pricing rows or it 503s — none exist yet.
 *  - Google Gemma 4 (both namespaces): no paid rate published, unpriceable.
 *  - OpenRouter `:free` pool (20 ids incl. openrouter/free): zero-cost listings
 *    Cencori no longer offers.
 *  - Lab promos: B.AI GLM-5.3 Flash (promo ended, now paid via its `bai`
 *    pricing row), Centaur, B.AI DeepSeek V4 Flash, Maximo Atlas (all billed).
 */

const EXPLICITLY_FREE_MODELS: ReadonlySet<string> = new Set([]);

export function isExplicitlyFree(_provider: string, _model: string): boolean {
    return EXPLICITLY_FREE_MODELS.has(`${_provider}:${_model}`);
}

export function hasStaticPricing(provider: string, model: string): boolean {
    return isExplicitlyFree(provider, model);
}

/** Empty since the retirement. Kept for tooling that enumerates the set. */
export function listFreeModelKeys(): string[] {
    return [...EXPLICITLY_FREE_MODELS];
}
