/**
 * Cencori's free-model catalog — the single list of models the customer is never
 * charged for.
 *
 * This lives apart from pricing.ts on purpose. pricing.ts imports the Supabase
 * admin client, which throws at module load without a service-role key, so
 * anything that reaches for it from a client component takes the whole page
 * down. The free set is inert data that the browser legitimately needs (the
 * model catalog and playground both label rows from it), so it must stay free of
 * server-only imports. Keep it that way: no DB, no env, no Node built-ins.
 *
 * Free here means free *to the customer*. It does not mean free to us — most of
 * these run on Cencori's own provider keys against a shared daily quota, so the
 * practical limit on the free tier is capacity, not catalog size. See
 * FREE_TIER_CAPACITY below before adding anything that assumes a specific model
 * will answer.
 */

/**
 * What each free source actually costs us and where it runs out. Kept next to
 * the list because every past outage in the free tier has been a quota story,
 * not a pricing one.
 *
 * - OpenRouter `:free` — OpenRouter absorbs the inference. The cap is on our
 *   account, not per model: under 10 purchased credits it is 50 requests/day
 *   across every `:free` id combined; at 10+ credits it rises to 1,000/day and
 *   stays there. Buying credits once is the cheapest capacity we can add.
 * - Groq free tier — Groq bills nothing on the free developer plan and enforces
 *   per-model limits instead (gpt-oss-120b: 1,000 req/day, 8k tokens/min). The
 *   most reliable source here in practice: every Groq id answered first try.
 * - Google Gemma — Gemma has no paid tier on the Gemini API at all, so it is the
 *   only entry here that no billing change can take away. Durable is not the
 *   same as reliable, though: measured on 2026-09-10, the Gemma endpoint returns
 *   intermittent 500 INTERNAL and occasionally hangs, roughly one call in three.
 *   Good as a permanent floor, wrong as a default — see DEFAULT_FREE_MODEL.
 * - Lab promos (B.AI, Centaur) — free only while the offer lasts, and the ids
 *   404 the moment it ends. Never route a default to one.
 */
export const FREE_TIER_CAPACITY = {
    openrouterFreeRequestsPerDay: 50,
    openrouterFreeRequestsPerDayWithCredits: 1000,
} as const;

const EXPLICITLY_FREE_MODELS = new Set([
    // Cencori's public free-model catalog. These intentionally bypass the
    // database pricing lookup and are never charged to the customer.
    //
    // Membership here must match the `free: true` entries in config.ts —
    // pricing-catalog.test.ts asserts every catalog model tagged free resolves
    // to zero static pricing, and fails if the two drift apart.
    //
    // Cerebras used to hold half this list; its account is unfunded (402 on
    // every model, re-confirmed 2026-09-10), so the free tier moved to Groq's
    // free developer plan, Google's Gemma models and OpenRouter's `:free`
    // listings. Every id below was called successfully on 2026-09-10.

    // ── Groq free developer plan ────────────────────────────────
    // Groq charges nothing on the free plan and rate-limits instead, so any
    // model the plan serves is free to us. Deliberately NOT listed here:
    // groq:openai/gpt-oss-120b and groq:openai/gpt-oss-20b, which carry active
    // model_pricing rows and are sold today. Zeroing those is a revenue
    // decision, not a catalog one — make it deliberately, not by editing this
    // list.
    'groq:groq/compound',
    'groq:groq/compound-mini',
    'groq:openai/gpt-oss-safeguard-20b',
    'groq:qwen/qwen3.8-27b',
    'groq:qwen/qwen3.6-27b',
    // Speech-to-text on the same free plan. These are priced per minute rather
    // than per token, so getUsageUnitPricingFromDB honours this set too.
    'groq:whisper-large-v3',
    'groq:whisper-large-v3-turbo',

    // ── Google Gemma ────────────────────────────────────────────
    // Served by the Gemini API on the same key as the paid Gemini models, but
    // Gemma publishes no paid rate — it is free at every tier, and so the most
    // durable entries in this file. The endpoint itself is not: it returns
    // intermittent 500 INTERNAL under normal load (measured 2026-09-10), so
    // callers should retry rather than treat a single failure as the model
    // being gone.
    'google:gemma-4-31b-it',
    'google:gemma-4-26b-a4b-it',

    // ── OpenRouter zero-cost tier ───────────────────────────────
    // Rate-limited and best treated as a pool: any single id can 429 under load,
    // so callers should be able to fall through to another one rather than
    // depend on a specific model. `openrouter/free` is that fallback expressed
    // as one id — OpenRouter routes it across the whole zero-cost pool, so it
    // survives individual models being withdrawn and is the right default.
    'openrouter:openrouter/free',
    'openrouter:poolside/laguna-s-2.1:free',
    'openrouter:poolside/laguna-xs-2.1:free',
    'openrouter:nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'openrouter:nvidia/nemotron-3-super-120b-a12b:free',
    'openrouter:nvidia/nemotron-3-ultra-550b-a55b:free',
    'openrouter:nvidia/nemotron-3.5-lightning:free',
    'openrouter:nvidia/nemotron-3.5-content-safety:free',
    'openrouter:inclusionai/ling-3.0-flash-vl:free',
    'openrouter:inclusionai/ling-3.0-flash-sante:free',
    'openrouter:inclusionai/ling-3.0-flash-fin:free',
    'openrouter:nex-agi/nex-n2.5-mini:free',
    'openrouter:nex-agi/nex-n2.5-pro:free',
    'openrouter:google/gemma-4-31b-it:free',
    'openrouter:google/gemma-4-26b-a4b-it:free',
    'openrouter:cohere/north-mini-code:free',
    'openrouter:dots-studio/dots-3-note-preview:free',
    'openrouter:liquid/lfm-2.5-2.6b:free',
    // Removed 2026-09-10 — 404 upstream, confirmed against OpenRouter's live
    // model list. They had been unusable in the catalog since roughly the end of
    // August: nvidia/nemotron-nano-12b-v2-vl:free, nvidia/nemotron-nano-9b-v2:free,
    // nvidia/nemotron-3-nano-30b-a3b:free, openai/gpt-oss-20b:free, and
    // stealth/ox-alpha (the anonymous preview ended, exactly as its note
    // predicted). `npm run sync:free-models` now catches this class
    // of rot before users do.

    // ── Lab promos (temporary) ──────────────────────────────────
    // This section is where free models go to die, and the 2026-09-10 sweep is
    // the evidence: every entry removed below had been advertised as free for
    // days or weeks after the upstream offer stopped honouring it. A promo has
    // no deprecation notice — it just starts charging or 401ing — so re-verify
    // this section before trusting it, and never route a default here.
    //
    // Removed 2026-09-10:
    //  - Centaur (`centaur:centaur` + `centaur:julian-origin`). The agreed free
    //    window closed 2026-08-29; the endpoint now answers "Incorrect API key
    //    provided". Advertised free for twelve days past the window.
    //  - B.AI DeepSeek V4 Flash and its vision variant, under both the
    //    `deepseek:` and `bai:` namespaces. The zero-credit promo ended and B.AI
    //    now answers "credit insufficient balance: balance=0 required=4".
    //  - Maximo Atlas, earlier: ran free until 2026-07-22, now billed from the
    //    row in 20260803_120000_maximo_atlas_paid_pricing.sql.
    //
    // Still honoured: GLM-5.3 Flash, billed at 0 Credits on B.AI Chat+API since
    // 2026-08-21. Branded under `zai` but routed through `bai` (router.ts), so
    // both namespaces are listed. Verified 2026-09-10.
    'zai:glm-5.3-flash',
    'bai:glm-5.3-flash',
]);

/**
 * The free model to reach for when a caller has not named one, or when the one
 * it named is exhausted. OpenRouter's own pool router: one id that fans out
 * across every zero-cost listing, so it does not go stale when a single model is
 * withdrawn, and it absorbs the per-model 429s that make individual `:free` ids
 * unreliable. Chosen over Gemma, which is more durable but answers less often.
 */
export const DEFAULT_FREE_MODEL = { provider: 'openrouter', model: 'openrouter/free' } as const;

export function isExplicitlyFree(provider: string, model: string): boolean {
    return EXPLICITLY_FREE_MODELS.has(`${provider}:${model}`);
}

export function hasStaticPricing(provider: string, model: string): boolean {
    return isExplicitlyFree(provider, model);
}

/** Every free model, as `provider:model` keys. Used by catalog tests and tooling. */
export function listFreeModelKeys(): string[] {
    return [...EXPLICITLY_FREE_MODELS];
}
