/**
 * Supported AI Providers and Models
 * 
 * This file defines all providers supported by Cencori
 * with their available models and metadata.
 */

export interface AIModel {
    id: string;
    name: string;
    type: string | string[];
    contextWindow: number;
    description?: string;
    free?: boolean;
    capabilities?: ModelCapabilities;
    /**
     * Vendor release date (YYYY-MM-DD): the catalog's "newly added" ordering
     * sorts on this, newest first. Day precision for 2026 launches, month
     * precision older — relative order is what matters, not the exact day.
     */
    addedAt?: string;
}

/**
 * Rich capability signals for the Features filter. Every flag is optional and
 * only ever set to `true`: anything uncertain is omitted, and filters treat a
 * missing flag as false — no fake precision. Family-level curation from
 * published provider docs (2026-09-23); verify per model when touching a row.
 */
export interface ModelCapabilities {
    /** Function calling / tool use. */
    tools?: boolean;
    /** Constrained JSON / structured outputs. */
    structuredOutput?: boolean;
    /** Document (PDF) input alongside text. */
    fileInput?: boolean;
    /** Video input. */
    videoInput?: boolean;
    /** Audio input. */
    audioInput?: boolean;
    /** Prompt caching (explicit; Google also caches implicitly). */
    caching?: boolean;
}

export interface AIProviderConfig {
    id: string;
    name: string;
    icon: string; // Path relative to /public/providers/
    website: string;
    docsUrl: string;
    keyPrefix: string; // Expected API key prefix (e.g., "sk-" for OpenAI)
    models: AIModel[];
}

export const SUPPORTED_PROVIDERS: AIProviderConfig[] = [
    {
        id: 'zai',
        name: 'Z.AI',
        icon: '/providers/zai.svg',
        website: 'https://z.ai',
        docsUrl: 'https://docs.z.ai/guides/llm/glm-5.2',
        keyPrefix: '',
        models: [
            { id: 'glm-5.2', name: 'GLM-5.2', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Flagship model, 1M context, coding & agentic, reasoning effort (max/high)', capabilities: { tools: true }, addedAt: '2026-06-15' },
            // Shown under Z.AI (the lab that makes it) but routed through B.AI
            // (see router.ts). Paid since 2026-09-23: the B.AI zero-credit promo
            // ended ("credit insufficient balance: balance=0") and the Z.AI key
            // is unfunded, so there is no free path left. Bills from the active
            // `bai:glm-5.3-flash` pricing row.
            { id: 'glm-5.3-flash', name: 'GLM-5.3 Flash', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Fast GLM model, 1M context, economical reasoning', capabilities: { tools: true }, addedAt: '2026-08-21' },
        ],
    },
    {
        id: 'openai',
        name: 'OpenAI',
        icon: '/providers/openai.svg',
        website: 'https://openai.com',
        docsUrl: 'https://platform.openai.com/docs',
        keyPrefix: 'sk-',
        models: [
            // GPT-6 Series (September 2026; servable but unlisted in /v1/models —
            // ids resolve upstream, verified 2026-09-23 by error-code probe)
            { id: 'gpt-6-astra', name: 'GPT-6 Astra', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'New generation flagship, computer use/coding/cyber/science, $10/$50 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-09-10' },
            { id: 'gpt-6-sol', name: 'GPT-6 Sol', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'GPT-6 flagship tier, $2/$10 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-09-10' },
            { id: 'gpt-6-luna', name: 'GPT-6 Luna', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'Cheapest frontier tier, $0.10/$0.50 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-09-10' },
            // GPT-5.6 Series (July 2026; repriced Aug 21 2026)
            { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'Flagship, SOTA coding/cyber/science, max/ultra reasoning, $4/$20 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-07-09' },
            { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'Balanced, competitive with GPT-5.5 at lower cost, $2/$12 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-07-09' },
            { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'Fast/affordable, outperforms GPT-5.5 peak at low cost, $0.20/$1.20 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-07-09' },
            { id: 'gpt-5.5', name: 'GPT-5.5', type: ['chat'], contextWindow: 1050000, description: 'New class of intelligence for real work and agents', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-04-23' },
            { id: 'gpt-5.5-pro', name: 'GPT-5.5 Pro', type: ['chat', 'reasoning'], contextWindow: 1050000, description: 'Highest-quality GPT-5.5, $30/$180 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-09-05' },
            { id: 'gpt-5.4', name: 'GPT-5.4 Thinking', type: ['chat', 'reasoning'], contextWindow: 1050000, description: 'Latest GPT-5.4 reasoning model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-03-05' },
            { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', type: ['chat', 'reasoning', 'code'], contextWindow: 400000, description: 'High-volume coding and agent model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-03-17' },
            { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', type: ['chat', 'reasoning'], contextWindow: 400000, description: 'Lowest-cost GPT-5.4 model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-03-17' },
            { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', type: ['chat', 'reasoning'], contextWindow: 400000, description: 'Most capable GPT-5.4 variant', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-03-05' },
            { id: 'gpt-5.3-chat-latest', name: 'GPT-5.3 Instant', type: ['chat'], contextWindow: 400000, description: 'Latest GPT-5.3 instant release', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-01-15' },
            { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', type: ['chat'], contextWindow: 400000, description: 'Most capable GPT-5.2 variant', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-12-11' },
            { id: 'gpt-5.2', name: 'GPT-5.2', type: ['chat'], contextWindow: 400000, description: 'Latest GPT-5.2 flagship', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-12-11' },
            { id: 'gpt-5.1', name: 'GPT-5.1', type: ['chat'], contextWindow: 400000, description: 'Improved GPT-5 generation', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-11-13' },
            { id: 'gpt-5-pro', name: 'GPT-5 Pro', type: ['chat'], contextWindow: 400000, description: 'High-quality GPT-5 variant', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-10-06' },
            { id: 'gpt-5', name: 'GPT-5', type: ['chat'], contextWindow: 400000, description: 'Flagship model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-08-07' },
            { id: 'gpt-5-mini', name: 'GPT-5 Mini', type: ['chat'], contextWindow: 400000, description: 'Fast and efficient', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-08-07' },
            { id: 'gpt-5-nano', name: 'GPT-5 Nano', type: ['chat'], contextWindow: 400000, description: 'Lowest-latency GPT-5 model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-08-07' },
            // GPT-4.1 / GPT-4o Series
            { id: 'gpt-4.1', name: 'GPT-4.1', type: ['chat', 'code'], contextWindow: 1047576, description: 'Long-context GPT-4.1', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-04-14' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', type: ['chat'], contextWindow: 1047576, description: 'Balanced GPT-4.1 model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-04-14' },
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', type: ['chat'], contextWindow: 1047576, description: 'Fast GPT-4.1 nano model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-04-14' },
            { id: 'gpt-4o', name: 'GPT-4o', type: ['chat'], contextWindow: 128000, description: 'Omni-modal model', capabilities: { tools: true, structuredOutput: true, fileInput: true, audioInput: true, caching: true }, addedAt: '2024-05-13' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', type: ['chat'], contextWindow: 128000, description: 'Fast and cost-effective', capabilities: { tools: true, structuredOutput: true, fileInput: true, audioInput: true, caching: true }, addedAt: '2024-07-18' },
            // O-Series Reasoning (latest)
            { id: 'o3', name: 'o3', type: ['reasoning', 'code'], contextWindow: 200000, description: 'Advanced reasoning model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-04-16' },
            { id: 'o3-mini', name: 'o3 Mini', type: ['reasoning'], contextWindow: 200000, description: 'Fast reasoning model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-01-31' },
            { id: 'o4-mini', name: 'o4 Mini', type: ['reasoning'], contextWindow: 200000, description: 'Successor to o1-mini', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-04-16' },
            { id: 'o1', name: 'o1', type: ['reasoning'], contextWindow: 200000, description: 'Legacy reasoning model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2024-12-17' },
            // Image Generation
            { id: 'gpt-image-2', name: 'GPT Image 2', type: ['image'], contextWindow: 0, description: 'State-of-the-art image generation model', addedAt: '2026-04-21' },
            { id: 'gpt-image-1.5', name: 'GPT Image 1.5', type: ['image'], contextWindow: 0, description: 'Best text rendering', addedAt: '2026-06-01' },
            { id: 'gpt-image-1', name: 'GPT Image 1', type: ['image'], contextWindow: 0, description: 'ChatGPT image generation model', addedAt: '2025-04-23' },
        ],
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        icon: '/providers/anthropic.svg',
        website: 'https://anthropic.com',
        docsUrl: 'https://docs.anthropic.com',
        keyPrefix: 'sk-ant-',
        // Kept in sync with Anthropic's GET /v1/models — a model we list but
        // Anthropic has retired fails upstream no matter what we price it at.
        models: [
            // Claude 5.1 Series (September 2026)
            { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Most capable model, succeeds Fable 5 at the same rate with 75% cheaper cache reads', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-09-01' },
            { id: 'claude-mythos-5-1', name: 'Claude Mythos 5.1', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Fable 5.1 under trusted-access safeguards, for vetted cybersecurity & life-sciences work', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-09-01' },
            // Claude Opus 5.5 (September 2026) — Anthropic's recommended default
            // for most workloads. $4/$20 per 1M, 1M context, adaptive thinking.
            { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Default for most workloads, long-horizon agentic coding, $4/$20 per 1M', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-09-20' },
            // Claude 5 Series (June-July 2026)
            { id: 'claude-fable-5', name: 'Claude Fable 5', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Most capable model, for the most demanding reasoning & long-horizon agentic work', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-06-09' },
            { id: 'claude-opus-5', name: 'Claude Opus 5', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'New flagship for complex agentic coding & enterprise work, succeeds Opus 4.8', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-07-24' },
            { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Anthropic\'s most agentic Sonnet, close to Opus-tier capabilities', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-06-30' },
            // Claude 4 Series (2025/2026)
            { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, dynamic workflows & effort control', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-05-28' },
            { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, improved reasoning & agentic coding', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-04-16' },
            { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, enhanced reasoning & coding', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-02-17' },
            { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, agentic coding record-breaker', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2026-02-05' },
            { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', type: ['chat', 'reasoning', 'code'], contextWindow: 200000, description: 'Previous-generation Opus', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-11-24' },
            { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', type: ['chat'], contextWindow: 200000, description: 'Enhanced coding & agents', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-09-29' },
            { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', type: ['chat'], contextWindow: 200000, description: 'Fastest Claude model', capabilities: { tools: true, structuredOutput: true, fileInput: true, caching: true }, addedAt: '2025-10-15' },
        ],
    },
    {
        id: 'google',
        name: 'Google',
        icon: '/providers/google.svg',
        website: 'https://ai.google.dev',
        docsUrl: 'https://ai.google.dev/docs',
        keyPrefix: 'AIza',
        models: [
            // Gemini 3.1 Series (Feb 2026)
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Latest flagship preview, 1M context, enhanced reasoning', capabilities: { tools: true, structuredOutput: true, fileInput: true, videoInput: true, audioInput: true, caching: true }, addedAt: '2026-02-15' },
            { id: 'gemini-3.1-pro-preview-customtools', name: 'Gemini 3.1 Pro (Custom Tools)', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Optimized for custom tools and bash', capabilities: { tools: true, structuredOutput: true, fileInput: true, videoInput: true, audioInput: true, caching: true }, addedAt: '2026-02-15' },
            { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (Nano Banana 2)', type: ['image'], contextWindow: 0, description: 'Reasoning-guided image synthesis, up to 4K', addedAt: '2025-11-25' },
            // Gemini 3 Series (Late 2025)
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Frontier speed & intelligence preview', capabilities: { tools: true, structuredOutput: true, fileInput: true, videoInput: true, audioInput: true, caching: true }, addedAt: '2025-11-15' },
            // Gemini 2.5 Series (Mid 2025)
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Enhanced reasoning & coding', capabilities: { tools: true, structuredOutput: true, fileInput: true, videoInput: true, audioInput: true, caching: true }, addedAt: '2025-06-15' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Thinking capabilities', capabilities: { tools: true, structuredOutput: true, fileInput: true, videoInput: true, audioInput: true, caching: true }, addedAt: '2025-06-15' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', type: ['chat'], contextWindow: 1000000, description: 'Speed optimized', capabilities: { tools: true, structuredOutput: true, fileInput: true, videoInput: true, audioInput: true, caching: true }, addedAt: '2025-07-15' },
            { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image', type: ['image'], contextWindow: 0, description: 'Fast photorealism', addedAt: '2026-01-15' },
            { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest Flash model, speed + reasoning', capabilities: { tools: true, structuredOutput: true, fileInput: true, videoInput: true, audioInput: true, caching: true }, addedAt: '2026-05-19' },
            // Gemma rows removed 2026-09-23 with the free-tier retirement: Google
            // publishes no paid rate for them, so they cannot be priced and are
            // gone from the catalog. Deliberately NOT re-added without pricing —
            // an unpriced row only trades a missing model for a 503.
        ],
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        icon: '/providers/mistral.svg',
        website: 'https://mistral.ai',
        docsUrl: 'https://docs.mistral.ai',
        keyPrefix: '',
        models: [
            // Mistral Large 3 (Dec 2025 - MoE)
            { id: 'mistral-large-latest', name: 'Mistral Large 3', type: ['chat'], contextWindow: 128000, description: '675B params, best open-weight multimodal', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-12-01' },
            { id: 'mistral-medium-latest', name: 'Mistral Medium 3.1', type: ['chat'], contextWindow: 128000, description: 'Frontier-class multimodal', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-12-01' },
            { id: 'mistral-small-latest', name: 'Mistral Small 3', type: ['chat'], contextWindow: 32000, description: '24B params, fast', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-12-01' },
            // Ministral (Dec 2025)
            { id: 'ministral-3b', name: 'Ministral 3B', type: ['chat'], contextWindow: 128000, description: 'Compact edge model', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-12-01' },
            { id: 'ministral-8b', name: 'Ministral 8B', type: ['chat'], contextWindow: 128000, description: 'Small efficient model', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-12-01' },
            { id: 'codestral-latest', name: 'Codestral 25.01', type: ['code', 'chat'], contextWindow: 256000, description: '2.5x faster code generation', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-12-01' },
            { id: 'devstral-latest', name: 'Devstral 2', type: ['code', 'chat'], contextWindow: 256000, description: 'Frontier code agents', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-12-01' },
            // Reasoning: `magistral-medium` removed 2026-09-10 — Mistral answers
            // "Invalid model: magistral-medium". The model still exists as
            // `magistral-medium-latest`; re-add it under that id together with a
            // pricing row, not on its own.
        ],
    },
    {
        id: 'groq',
        name: 'Groq',
        icon: '/providers/groq.svg',
        website: 'https://groq.com',
        docsUrl: 'https://console.groq.com/docs',
        keyPrefix: 'gsk_',
        models: [
            { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', type: ['chat', 'reasoning'], contextWindow: 131072, description: 'Groq production model', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-08-05' },
            { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', type: ['chat', 'reasoning'], contextWindow: 131072, description: 'Groq production model', capabilities: { tools: true, structuredOutput: true }, addedAt: '2025-08-05' },
            // Groq serves its open-weight models on the free developer plan, which
            // bills nothing — but Cencori no longer offers a free tier, so only
            // rows with active model_pricing are listed here. The plan's
            // remaining servable ids (gpt-oss-safeguard-20b, qwen3.8-27b,
            // allam-2-7b) were removed 2026-09-23: no flat token rate to price
            // them from, and an unpriced row only trades a missing model for a
            // 503. Re-add with pricing rows if they are ever sold.
            //
            // Verified 2026-09-23 against Groq's live /models: `groq/compound`,
            // `groq/compound-mini` and `qwen/qwen3.6-27b` 404 and stay removed.
        ],
    },
    {
        id: 'cohere',
        name: 'Cohere',
        icon: '/providers/cohere.svg',
        website: 'https://cohere.com',
        docsUrl: 'https://docs.cohere.com',
        keyPrefix: '',
        models: [
            // Command A (March 2025 - New flagship)
            // Command R+ (Aug 2024 update)
            { id: 'command-r-plus-08-2024', name: 'Command R+', type: ['chat'], contextWindow: 128000, description: 'Complex RAG and multi-step', capabilities: { tools: true }, addedAt: '2024-08-30' },
            { id: 'command-light', name: 'Command Light', type: ['chat'], contextWindow: 4096, description: 'Fast and efficient', capabilities: { tools: true }, addedAt: '2024-04-04' },
        ],
    },
    {
        id: 'together',
        name: 'Together AI',
        icon: '/providers/together.svg',
        website: 'https://together.ai',
        docsUrl: 'https://docs.together.ai',
        keyPrefix: '',
        // Emptied 2026-09-10. None of these were callable: they carried no
        // pricing rows, and TOGETHER_API_KEY returns 401 Unauthorized, so the
        // managed key could not serve them either. Their upstream status was
        // never confirmed — the key is invalid, so it could not be checked —
        // and they were removed as unusable rather than as retired.
        //
        // The provider entry stays so a customer can still bring their own
        // Together key; BYOK routing does not depend on this list. To restore
        // the managed catalog: fix TOGETHER_API_KEY, re-read Together's live
        // model list, then add back only the ids that exist, each with pricing.
        models: [],
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        icon: '/providers/perplexity.svg',
        website: 'https://perplexity.ai',
        docsUrl: 'https://docs.perplexity.ai',
        keyPrefix: 'pplx-',
        models: [
            // Sonar Models (2025)
            { id: 'sonar-pro', name: 'Sonar Pro', type: ['search'], contextWindow: 128000, description: 'Enhanced search, richer context', addedAt: '2025-02-01' },
            { id: 'sonar', name: 'Sonar', type: ['search'], contextWindow: 128000, description: 'Default web-connected', addedAt: '2025-02-01' },
            { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', type: ['reasoning', 'search'], contextWindow: 128000, description: 'Deep inference & research', addedAt: '2025-02-01' },
            // Legacy
        ],
    },
    // OpenRouter was removed 2026-09-23: with the free tier retired it was
    // purely a paid proxy, and its margin stacked on Cencori's markup. DeepSeek,
    // Kimi and Qwen are served direct now (deepseek / moonshot / qwen providers);
    // the frontier dupes (GPT-5, Opus 4.5, Gemini, Grok) were already direct.
    // Pricing rows retired in 20260923_120000_retire_openrouter_provider.sql.
    {
        id: 'xai',
        name: 'xAI',
        icon: '/providers/xai.svg',
        website: 'https://x.ai',
        docsUrl: 'https://docs.x.ai',
        keyPrefix: 'xai-',
        models: [
            // Grok 4.7 (September 2026) — frontier xAI reasoning model, succeeds
            // 4.6 at the same $2/$6 rate. Text + image input, 500k context.
            { id: 'grok-4.7', name: 'Grok 4.7', type: ['reasoning', 'chat'], contextWindow: 500000, description: 'Frontier xAI reasoning model with text and image input, $2/$6 per 1M', capabilities: { tools: true, structuredOutput: true, caching: true }, addedAt: '2026-09-21' },
            // Grok 4.6 (August 2026)
            { id: 'grok-4.6', name: 'Grok 4.6', type: ['reasoning', 'chat'], contextWindow: 500000, description: 'Frontier xAI reasoning model with text and image input', capabilities: { tools: true, caching: true }, addedAt: '2026-08-15' },
            // Grok 4.5 Series (July 2026)
            { id: 'grok-4.5', name: 'Grok 4.5', type: ['reasoning', 'chat'], contextWindow: 500000, description: 'Previous xAI flagship, same price as Grok 4.6', capabilities: { tools: true }, addedAt: '2026-07-15' },
            // Grok 4.3 Series (April 2026)
            { id: 'grok-4.3', name: 'Grok 4.3', type: ['reasoning', 'chat'], contextWindow: 1000000, description: 'Long-context xAI reasoning model with text and image input', capabilities: { tools: true }, addedAt: '2026-04-15' },
            // Grok Voice Series
            // Grok 4 Series (July-Nov 2025)
            // Grok 3 Series
            // Code
        ],
    },
    {
        id: 'meta',
        name: 'Meta AI',
        icon: '/providers/meta.svg',
        website: 'https://llama.meta.com',
        docsUrl: 'https://llama.meta.com/docs',
        keyPrefix: '',
        // Emptied 2026-09-10. These had two independent faults: no pricing rows,
        // and the bare `llama-*` ids resolve to the `groq` provider under the
        // prefix heuristic in router.ts, so a request never reached Meta in the
        // first place. Meta publishes no first-party inference API — this
        // provider is served by TOGETHER_API_KEY, which returns 401 — so there
        // was no working path to any of them.
        //
        // If Llama is wanted back, serve it from a provider that actually hosts
        // it (Groq and OpenRouter both do) rather than under a `meta` namespace
        // with no endpoint behind it.
        models: [],
    },
    {
        id: 'qwen',
        name: 'Qwen',
        icon: '/providers/qwen.svg',
        website: 'https://qwenlm.ai',
        docsUrl: 'https://qwen.readthedocs.io',
        keyPrefix: '',
        // Emptied 2026-09-10. All four Qwen 2.5 / QwQ ids were removed after
        // Qwen's live catalog was checked with a working key: it returns 165
        // models and none of these are among them, so every request for one
        // failed upstream. The earlier note that the key was unfunded was
        // wrong — the key works; the models are gone.
        //
        // Repopulating this is real work, not a paste: current ids are
        // `qwen3.8-max`, `qwen3.8-flash`, `qwen-flash`, `qwen-coder-plus` and
        // similar, and each needs a model_pricing row before it is callable.
        // Listing them without pricing would only trade a dead id for a 503.
        models: [],
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        icon: '/providers/deepseek.svg',
        website: 'https://deepseek.com',
        docsUrl: 'https://platform.deepseek.com/docs',
        keyPrefix: 'sk-',
        models: [
            // V4 Series (April 2026)
            { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: '1.6T total / 49B active params, flagship performance', capabilities: { tools: true, structuredOutput: true }, addedAt: '2026-04-24' },
            // DeepSeek V4 Flash (+ vision-exp) removed 2026-09-10 — the B.AI promo
            // that made them free has ended; see the bai provider block.
            // V3.2 Series (Dec 2025)
            // V3.1 (Aug 2025)
            // V3 (March 2025 update)
            // Coder
        ],
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        icon: '/providers/cerebras.svg',
        website: 'https://cerebras.ai',
        docsUrl: 'https://docs.cerebras.ai',
        keyPrefix: 'csk-',
        models: [
            // The Cerebras account is unfunded: every model returns 402
            // payment_required as of 2026-08-20, so none of these can carry the
            // free tier any more. `free: true` was removed rather than the rows
            // themselves — the models come back the moment the account is topped
            // up, and they bill from their model_pricing rows when it is.
            // `zai-glm-4.7` is gone entirely: Cerebras archived it (404
            // model_archived), so it is not orderable at any price.
            { id: 'gpt-oss-120b', name: 'GPT OSS 120B (Cerebras)', type: ['chat'], contextWindow: 131072, description: '120B open model, 3000 tok/s inference', addedAt: '2025-08-05' },
            { id: 'gemma-4-31b', name: 'Gemma 4 31B (Cerebras)', type: ['chat', 'vision'], contextWindow: 131072, description: 'Multimodal production model on Cerebras', addedAt: '2026-08-01' },
        ],
    },
    {
        id: 'maximo',
        name: 'Maximo AI',
        icon: '/partners/max.jpeg',
        website: 'https://maximoai.co',
        docsUrl: 'https://maximoai.co/platform',
        keyPrefix: '',
        models: [
            { id: 'maximo-atlas-1.3', name: 'Maximo Atlas 1.3', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Full-stack frontier agent for terminal, code, and web work at max reasoning effort, $0.20/$0.02 cached/$0.50 per 1M', capabilities: { tools: true }, addedAt: '2026-09-23' },
            { id: 'maximo-atlas-1.2', name: 'Maximo Atlas 1.2', type: ['chat', 'reasoning', 'code', 'vision'], contextWindow: 1000000, description: 'Agentic coding & debugging across large codebases, image input, 1M context / 128K max output, prompt caching, reasoning low→max. $0.11/$0.01 cached/$0.30 per 1M through 2026-08-31 UTC, then $0.55/$0.05/$1.50', capabilities: { tools: true }, addedAt: '2026-08-17' },
            // maximo-atlas-1.1 retired 2026-09-23: gone from Maximo's live
            // /models (1.2/1.3/1.4 served). Pricing row retired alongside.
            // 1.3/1.4 deliberately NOT added: no published rates to price them
            // from, and an unpriced row only trades a missing model for a 503.
        ],
    },
    {
        id: 'helix',
        name: 'Helix',
        icon: '/providers/helix.svg',
        website: 'https://launchverse.app',
        docsUrl: 'https://launchverse.app',
        keyPrefix: 'csk_cencori_',
        models: [
            { id: 'helix-advisor', name: 'Helix Advisor', type: ['chat', 'reasoning', 'code'], contextWindow: 128000, description: 'Autonomous engineering agent (advisor mode) by Launchverse — architecture, debugging, and planning guidance. Read-only.', addedAt: '2026-07-22' },
        ],
    },
    {
        id: 'bai',
        name: 'B.AI',
        icon: '/providers/deepseek.svg',
        website: 'https://b.ai',
        docsUrl: 'https://b.ai/docs',
        keyPrefix: 'sk-',
        // Backend provider for GLM (and formerly DeepSeek) models that are shown
        // to customers under their real vendor's name. The router overrides in
        // router.ts steer the model ids here transparently.
        //
        // This list is EMPTY on purpose, and must stay that way. Anything added
        // here becomes a visible catalog row: components/models/ModelCatalog.tsx
        // flattens every provider's `models` with no de-duplication, and because
        // these ids are free, publicProviderLabel brands them "Cencori" — the
        // same label the `zai` entry gets. The result was two rows with the same
        // id, the same provider and no way to tell them apart, which is what
        // `glm-5.3-flash` looked like here until 2026-09-10.
        //
        // Pricing does NOT come from this list. B.AI keeps its own rows under the
        // `bai` namespace (20260830_170000_bai_deepseek_glm_catalog.sql) and the
        // free override lives in free-models.ts as `bai:glm-5.3-flash` — which
        // must stay, because the router resolves the model to `bai` before
        // pricing is looked up. Removing the catalog row does not remove either.
        //
        // Also gone from here on 2026-09-10: deepseek-v4-flash and its vision
        // variant, whose zero-credit promo ended ("credit insufficient balance:
        // balance=0 required=4"). Their paid `bai` pricing rows are still active.
        models: [],
    },
    {
        id: 'centaur',
        name: 'Centaur',
        icon: '/providers/centaur.svg',
        website: '',
        docsUrl: '',
        keyPrefix: '',
        // Emptied 2026-09-10. The stealth preview's agreed free window closed on
        // 2026-08-29 and the endpoint now answers "Incorrect API key provided",
        // so the model had been advertised as free for twelve days after it
        // stopped being reachable. If the partnership resumes, re-add with a
        // real model id and pricing rows rather than restoring the codename.
        models: [],
    },
    // ── Voice providers (BYOK) ──────────────────────────────────
    // Models are chosen per-call on the Voice endpoints, so these carry no
    // `models` list here — the entry exists so users can add a BYOK key and the
    // gateway (lib/audio/*) uses it. See the Voice docs for the model catalog.
    {
        id: 'deepgram',
        name: 'Deepgram',
        icon: '/providers/voice.svg',
        website: 'https://deepgram.com',
        docsUrl: 'https://developers.deepgram.com',
        keyPrefix: '',
        models: [],
    },
    {
        id: 'cartesia',
        name: 'Cartesia',
        icon: '/providers/voice.svg',
        website: 'https://cartesia.ai',
        docsUrl: 'https://docs.cartesia.ai',
        keyPrefix: 'sk_car_',
        models: [],
    },
    {
        id: 'spitch',
        name: 'Spitch',
        icon: '/providers/voice.svg',
        website: 'https://spitch.app',
        docsUrl: 'https://docs.spi-tch.com',
        keyPrefix: '',
        models: [],
    },
    {
        id: 'assemblyai',
        name: 'AssemblyAI',
        icon: '/providers/voice.svg',
        website: 'https://assemblyai.com',
        docsUrl: 'https://www.assemblyai.com/docs',
        keyPrefix: '',
        models: [],
    },
    {
        id: 'elevenlabs',
        name: 'ElevenLabs',
        icon: '/providers/voice.svg',
        website: 'https://elevenlabs.io',
        docsUrl: 'https://elevenlabs.io/docs',
        keyPrefix: '',
        models: [],
    },
];

/**
 * Get provider config by ID
 */
export function getProvider(providerId: string): AIProviderConfig | undefined {
    return SUPPORTED_PROVIDERS.find(p => p.id === providerId);
}

/**
 * Get all models for a provider
 */
export function getModelsForProvider(providerId: string): AIModel[] {
    return getProvider(providerId)?.models || [];
}

/**
 * Get chat/reasoning models for a provider (excludes image models)
 */
export function getChatModelsForProvider(providerId: string): AIModel[] {
    return getModelsForProvider(providerId).filter(m => {
        const types = Array.isArray(m.type) ? m.type : [m.type];
        return !types.includes('image');
    });
}

/**
 * Get image generation models for a provider
 */
export function getImageModelsForProvider(providerId: string): AIModel[] {
    return getModelsForProvider(providerId).filter(m => {
        const types = Array.isArray(m.type) ? m.type : [m.type];
        return types.includes('image');
    });
}

/**
 * Get model by ID across all providers
 */
export function getModel(modelId: string): AIModel | undefined {
    for (const provider of SUPPORTED_PROVIDERS) {
        const model = provider.models.find(m => m.id === modelId);
        if (model) return model;
    }
    return undefined;
}

/**
 * Detect provider from model ID
 */
export function detectProviderFromModel(modelId: string): string | undefined {
    for (const provider of SUPPORTED_PROVIDERS) {
        if (provider.models.some(m => m.id === modelId)) {
            return provider.id;
        }
    }
    // Fallback pattern detection
    if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4')) return 'openai';
    if (modelId.startsWith('claude-')) return 'anthropic';
    if (modelId.startsWith('gemini-')) return 'google';
    if (modelId.startsWith('mistral-') || modelId.startsWith('codestral') || modelId.startsWith('ministral-')) return 'mistral';
    if (modelId.includes('llama')) return 'groq';
    if (modelId.startsWith('jamba')) return 'ai21';
    if (modelId.includes('bedrock')) return 'bedrock';
    if (modelId.includes('nova')) return 'nova';
    if (modelId.includes('azure')) return 'azure';
    if (modelId.includes('cerebras')) return 'cerebras';
    if (modelId.startsWith('@cf')) return 'cloudflare';
    if (modelId.includes('deepinfra')) return 'deepinfra';
    if (modelId.includes('fireworks')) return 'fireworks';
    if (modelId.includes('nvidia') || modelId.includes('nemotron')) return 'nvidia';
    if (modelId.includes('sambanova')) return 'sambanova';
    if (modelId.startsWith('solar')) return 'upstage';
    if (modelId.startsWith('abab')) return 'minimax';
    if (modelId.startsWith('moonshot')) return 'moonshot';
    if (modelId.startsWith('step-')) return 'stepfun';
    if (modelId.startsWith('ernie')) return 'baidu';
    if (modelId.startsWith('qwen-') && !modelId.includes('deepinfra')) return 'alibaba';
    return undefined;
}
