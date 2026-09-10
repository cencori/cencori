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
            { id: 'glm-5.2', name: 'GLM-5.2', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Flagship model, 1M context, coding & agentic, reasoning effort (max/high)' },
            // The one visible GLM-5.3 Flash row. Served through B.AI (see the bai
            // provider block) but shown under Z.AI, which actually makes the model.
            { id: 'glm-5.3-flash', name: 'GLM-5.3 Flash', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Fast GLM model, 1M context, economical reasoning — free', free: true },
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
            // GPT-5.6 Series (July 2026)
            { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'Flagship, SOTA coding/cyber/science, max/ultra reasoning, $5/$30 per 1M' },
            { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'Balanced, competitive with GPT-5.5 at 2x lower cost, $2.50/$15 per 1M' },
            { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', type: ['chat', 'reasoning', 'code'], contextWindow: 1050000, description: 'Fast/affordable, outperforms GPT-5.5 peak at 25x lower cost, $1/$6 per 1M' },
            { id: 'gpt-5.5', name: 'GPT-5.5', type: ['chat'], contextWindow: 1050000, description: 'New class of intelligence for real work and agents' },
            { id: 'gpt-5.4', name: 'GPT-5.4 Thinking', type: ['chat', 'reasoning'], contextWindow: 1050000, description: 'Latest GPT-5.4 reasoning model' },
            { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', type: ['chat', 'reasoning', 'code'], contextWindow: 400000, description: 'High-volume coding and agent model' },
            { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', type: ['chat', 'reasoning'], contextWindow: 400000, description: 'Lowest-cost GPT-5.4 model' },
            { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', type: ['chat', 'reasoning'], contextWindow: 400000, description: 'Most capable GPT-5.4 variant' },
            { id: 'gpt-5.3-chat-latest', name: 'GPT-5.3 Instant', type: ['chat'], contextWindow: 400000, description: 'Latest GPT-5.3 instant release' },
            { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', type: ['chat'], contextWindow: 400000, description: 'Most capable GPT-5.2 variant' },
            { id: 'gpt-5.2', name: 'GPT-5.2', type: ['chat'], contextWindow: 400000, description: 'Latest GPT-5.2 flagship' },
            { id: 'gpt-5.1', name: 'GPT-5.1', type: ['chat'], contextWindow: 400000, description: 'Improved GPT-5 generation' },
            { id: 'gpt-5-pro', name: 'GPT-5 Pro', type: ['chat'], contextWindow: 400000, description: 'High-quality GPT-5 variant' },
            { id: 'gpt-5', name: 'GPT-5', type: ['chat'], contextWindow: 400000, description: 'Flagship model' },
            { id: 'gpt-5-mini', name: 'GPT-5 Mini', type: ['chat'], contextWindow: 400000, description: 'Fast and efficient' },
            { id: 'gpt-5-nano', name: 'GPT-5 Nano', type: ['chat'], contextWindow: 400000, description: 'Lowest-latency GPT-5 model' },
            // GPT-4.1 / GPT-4o Series
            { id: 'gpt-4.1', name: 'GPT-4.1', type: ['chat', 'code'], contextWindow: 1047576, description: 'Long-context GPT-4.1' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', type: ['chat'], contextWindow: 1047576, description: 'Balanced GPT-4.1 model' },
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', type: ['chat'], contextWindow: 1047576, description: 'Fast GPT-4.1 nano model' },
            { id: 'gpt-4o', name: 'GPT-4o', type: ['chat'], contextWindow: 128000, description: 'Omni-modal model' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', type: ['chat'], contextWindow: 128000, description: 'Fast and cost-effective' },
            // O-Series Reasoning (latest)
            { id: 'o3', name: 'o3', type: ['reasoning', 'code'], contextWindow: 200000, description: 'Advanced reasoning model' },
            { id: 'o3-mini', name: 'o3 Mini', type: ['reasoning'], contextWindow: 200000, description: 'Fast reasoning model' },
            { id: 'o4-mini', name: 'o4 Mini', type: ['reasoning'], contextWindow: 200000, description: 'Successor to o1-mini' },
            { id: 'o1', name: 'o1', type: ['reasoning'], contextWindow: 200000, description: 'Legacy reasoning model' },
            // Image Generation
            { id: 'gpt-image-2', name: 'GPT Image 2', type: ['image'], contextWindow: 0, description: 'State-of-the-art image generation model' },
            { id: 'gpt-image-1.5', name: 'GPT Image 1.5', type: ['image'], contextWindow: 0, description: 'Best text rendering' },
            { id: 'gpt-image-1', name: 'GPT Image 1', type: ['image'], contextWindow: 0, description: 'ChatGPT image generation model' },
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
            { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Most capable model, succeeds Fable 5 at the same rate with 75% cheaper cache reads' },
            { id: 'claude-mythos-5-1', name: 'Claude Mythos 5.1', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Fable 5.1 under trusted-access safeguards, for vetted cybersecurity & life-sciences work' },
            // Claude 5 Series (June-July 2026)
            { id: 'claude-fable-5', name: 'Claude Fable 5', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Most capable model, for the most demanding reasoning & long-horizon agentic work' },
            { id: 'claude-opus-5', name: 'Claude Opus 5', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'New flagship for complex agentic coding & enterprise work, succeeds Opus 4.8' },
            { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Anthropic\'s most agentic Sonnet, close to Opus-tier capabilities' },
            // Claude 4 Series (2025/2026)
            { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, dynamic workflows & effort control' },
            { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, improved reasoning & agentic coding' },
            { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, enhanced reasoning & coding' },
            { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest flagship, agentic coding record-breaker' },
            { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', type: ['chat', 'reasoning', 'code'], contextWindow: 200000, description: 'Previous-generation Opus' },
            { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', type: ['chat'], contextWindow: 200000, description: 'Enhanced coding & agents' },
            { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', type: ['chat'], contextWindow: 200000, description: 'Fastest Claude model' },
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
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Latest flagship preview, 1M context, enhanced reasoning' },
            { id: 'gemini-3.1-pro-preview-customtools', name: 'Gemini 3.1 Pro (Custom Tools)', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Optimized for custom tools and bash' },
            { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (Nano Banana 2)', type: ['image'], contextWindow: 0, description: 'Reasoning-guided image synthesis, up to 4K' },
            // Gemini 3 Series (Late 2025)
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Frontier speed & intelligence preview' },
            // Gemini 2.5 Series (Mid 2025)
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Enhanced reasoning & coding' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Thinking capabilities' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', type: ['chat'], contextWindow: 1000000, description: 'Speed optimized' },
            { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image', type: ['image'], contextWindow: 0, description: 'Fast photorealism' },
            { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Latest Flash model, speed + reasoning' },
            // Gemma — open-weight, served on the same Gemini API key. Google
            // publishes no paid rate for these, so they are free at every tier
            // and cannot be withdrawn by a billing change. The endpoint 500s
            // intermittently (measured 2026-09-10); worth a retry, not a
            // delisting.
            //
            // Deliberately NOT tagged `vision`. Gemma 4 is a multimodal
            // checkpoint and OpenRouter reports image+video input for it, but
            // every image request to the Gemini API endpoint failed on
            // 2026-09-10 (500 INTERNAL, then empty 404s) while text on the same
            // model succeeded. Tag it once an image actually round-trips.
            { id: 'gemma-4-31b-it', name: 'Gemma 4 31B', type: ['chat', 'reasoning'], contextWindow: 262144, description: 'Open-weight Google model, 262k context — free', free: true },
            { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B', type: ['chat', 'reasoning'], contextWindow: 262144, description: 'Open-weight Google MoE, 262k context — free', free: true },
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
            { id: 'mistral-large-latest', name: 'Mistral Large 3', type: ['chat'], contextWindow: 128000, description: '675B params, best open-weight multimodal' },
            { id: 'mistral-medium-latest', name: 'Mistral Medium 3.1', type: ['chat'], contextWindow: 128000, description: 'Frontier-class multimodal' },
            { id: 'mistral-small-latest', name: 'Mistral Small 3', type: ['chat'], contextWindow: 32000, description: '24B params, fast' },
            // Ministral (Dec 2025)
            { id: 'ministral-3b', name: 'Ministral 3B', type: ['chat'], contextWindow: 128000, description: 'Compact edge model' },
            { id: 'ministral-8b', name: 'Ministral 8B', type: ['chat'], contextWindow: 128000, description: 'Small efficient model' },
            { id: 'codestral-latest', name: 'Codestral 25.01', type: ['code', 'chat'], contextWindow: 256000, description: '2.5x faster code generation' },
            { id: 'devstral-latest', name: 'Devstral 2', type: ['code', 'chat'], contextWindow: 256000, description: 'Frontier code agents' },
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
            { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', type: ['chat', 'reasoning'], contextWindow: 131072, description: 'Groq production model' },
            { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', type: ['chat', 'reasoning'], contextWindow: 131072, description: 'Groq production model' },
            { id: 'groq/compound', name: 'Compound', type: ['chat'], contextWindow: 131072, description: 'Groq compound AI system', free: true },
            { id: 'groq/compound-mini', name: 'Compound Mini', type: ['chat'], contextWindow: 131072, description: 'Groq compound AI mini', free: true },
            // Free on Groq's developer plan, which bills nothing and rate-limits
            // instead. gpt-oss-120b/20b above stay paid on purpose — they carry
            // active pricing rows (see free-models.ts).
            { id: 'openai/gpt-oss-safeguard-20b', name: 'GPT OSS Safeguard 20B', type: ['chat', 'reasoning'], contextWindow: 131072, description: 'Safety-classification variant of GPT OSS 20B — free', free: true },
            { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', type: ['chat', 'reasoning', 'code'], contextWindow: 131072, description: 'Qwen 3.8 on Groq, fast reasoning — free', free: true },
            { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', type: ['chat', 'reasoning', 'code'], contextWindow: 131072, description: 'Qwen 3.6 on Groq — free', free: true },
            { id: 'allam-2-7b', name: 'Allam 2 7B', type: ['chat'], contextWindow: 131072, description: 'Arabic-capable small model on Groq' },
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
            { id: 'command-r-plus-08-2024', name: 'Command R+', type: ['chat'], contextWindow: 128000, description: 'Complex RAG and multi-step' },
            { id: 'command-light', name: 'Command Light', type: ['chat'], contextWindow: 4096, description: 'Fast and efficient' },
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
            { id: 'sonar-pro', name: 'Sonar Pro', type: ['search'], contextWindow: 128000, description: 'Enhanced search, richer context' },
            { id: 'sonar', name: 'Sonar', type: ['search'], contextWindow: 128000, description: 'Default web-connected' },
            { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', type: ['reasoning', 'search'], contextWindow: 128000, description: 'Deep inference & research' },
            // Legacy
        ],
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        icon: '/providers/openrouter.svg',
        website: 'https://openrouter.ai',
        docsUrl: 'https://openrouter.ai/docs',
        keyPrefix: 'sk-or-',
        // Model ids, context windows and pricing here are read from
        // https://openrouter.ai/api/v1/models, which is the authoritative live
        // catalog — an id absent from that response 404s at inference no matter
        // what this file says. Verified 2026-08-17.
        //
        // OpenRouter is also how Cencori serves the open-weight Chinese models
        // (DeepSeek, Kimi, Qwen) without provisioning a direct key with each
        // lab. The trade is margin: OpenRouter's published rate already includes
        // their cut, and Cencori's markup stacks on top, so the same model costs
        // the end user more here than through a funded direct key.
        models: [
            { id: 'openai/gpt-5', name: 'GPT-5 (via OpenRouter)', type: ['chat'], contextWindow: 256000, description: 'Access any model' },
            { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5 (via OpenRouter)', type: ['chat'], contextWindow: 200000, description: 'Unified billing' },
            // `google/gemini-3-pro` and `x-ai/grok-4` were listed here but do not
            // exist on OpenRouter; they are replaced by the ids it actually serves.
            { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (via OpenRouter)', type: ['chat', 'reasoning'], contextWindow: 1048576, description: 'Google flagship preview through OpenRouter' },
            { id: 'x-ai/grok-4.3', name: 'Grok 4.3 (via OpenRouter)', type: ['reasoning'], contextWindow: 1000000, description: 'Long-context xAI reasoning model' },
            { id: 'x-ai/grok-4.6', name: 'Grok 4.6 (via OpenRouter)', type: ['reasoning', 'chat'], contextWindow: 500000, description: 'Frontier xAI reasoning model' },
            // ── Open-weight models (the "free and open source" tier) ──────────
            { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro (via OpenRouter)', type: ['chat', 'reasoning', 'code'], contextWindow: 1048576, description: '1.6T total / 49B active params, flagship open-weight model' },
            { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash (via OpenRouter)', type: ['chat', 'reasoning', 'code'], contextWindow: 1048576, description: 'Fast, very low cost open-weight model' },
            { id: 'moonshotai/kimi-k3', name: 'Kimi K3 (via OpenRouter)', type: ['chat', 'reasoning', 'code'], contextWindow: 1048576, description: 'Moonshot flagship, 1M context' },
            { id: 'moonshotai/kimi-k2.7-code', name: 'Kimi K2.7 Code (via OpenRouter)', type: ['code', 'chat', 'reasoning'], contextWindow: 262144, description: 'Coding-tuned Kimi, strong price/performance' },
            { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6 (via OpenRouter)', type: ['chat', 'reasoning', 'code'], contextWindow: 262144, description: 'General-purpose Kimi K2 generation' },
            { id: 'qwen/qwen3.8-max', name: 'Qwen 3.8 Max (via OpenRouter)', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: 'Alibaba flagship, 1M context' },
            { id: 'qwen/qwen3-coder-plus', name: 'Qwen 3 Coder Plus (via OpenRouter)', type: ['code', 'chat'], contextWindow: 1000000, description: 'Code-specialised Qwen, 1M context' },

            // ── Zero-cost tier (`:free`) ──────────────────────────────────────
            // OpenRouter serves these at no charge, so they cost Cencori nothing
            // and are billed to the customer at zero (see EXPLICITLY_FREE_MODELS
            // in pricing.ts — the two lists must stay in sync or the catalog test
            // fails). They replace the Groq Llama and Cerebras models that used to
            // carry the free tier: Groq decommissioned the former and the Cerebras
            // account is unfunded (402 on every model, re-confirmed 2026-09-10).
            //
            // Every id below returned a 200 on 2026-09-10, checked against
            // https://openrouter.ai/api/v1/models. Five ids that used to sit here
            // had already 404'd upstream by then and were removed; run
            // `npm run sync:free-models` to catch the next round before users do.
            //
            // The real constraint is not the model count — it is the account cap.
            // OpenRouter allows 50 `:free` requests/day across ALL of these
            // combined until 10 credits are purchased, then 1,000/day. Adding
            // models here does not add capacity.
            //
            // Most of these are reasoning models that spend the first tokens on a
            // hidden reasoning trace, so a small max_tokens returns empty content.
            // `poolside/laguna-s-2.1:free` answers cleanly at low budgets, which is
            // why the first-test path uses it.

            // OpenRouter's own pool router: one id fanned out across every
            // zero-cost listing. It cannot go stale when a single model is
            // withdrawn, so it is the default free model (DEFAULT_FREE_MODEL).
            { id: 'openrouter/free', name: 'Auto (free pool)', type: ['chat', 'reasoning'], contextWindow: 200000, description: 'Automatically routes across the whole free pool. Survives any single free model being withdrawn — the most reliable free option', free: true },

            { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1 (free)', type: ['chat'], contextWindow: 262144, description: 'Free tier. Clean short answers, no reasoning preamble', free: true },
            { id: 'poolside/laguna-xs-2.1:free', name: 'Laguna XS 2.1 (free)', type: ['chat'], contextWindow: 262144, description: 'Free tier. Smallest Laguna', free: true },
            { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni 30B (free)', type: ['chat', 'reasoning', 'vision'], contextWindow: 256000, description: 'Free tier. Omni-modal; reads images and audio', free: true },
            { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B (free)', type: ['chat', 'reasoning'], contextWindow: 262144, description: 'Free tier. 120B MoE, strongest free reasoning; overloads under load', free: true },
            { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B (free)', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Free tier. 550B MoE, 1M context; overloads under load', free: true },
            { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning (free)', type: ['chat', 'reasoning'], contextWindow: 1000000, description: 'Free tier. 1M context, low latency', free: true },
            { id: 'nvidia/nemotron-3.5-content-safety:free', name: 'Nemotron 3.5 Content Safety (free)', type: ['chat'], contextWindow: 128000, description: 'Free tier. Content-safety classifier — returns a safety verdict, not prose', free: true },
            { id: 'inclusionai/ling-3.0-flash-vl:free', name: 'Ling 3.0 Flash VL (free)', type: ['chat', 'reasoning', 'vision'], contextWindow: 262144, description: 'Free tier. Vision-language; reads images', free: true },
            { id: 'inclusionai/ling-3.0-flash-sante:free', name: 'Ling 3.0 Flash Santé (free)', type: ['chat', 'reasoning'], contextWindow: 262144, description: 'Free tier. Health/life-sciences tuned', free: true },
            { id: 'inclusionai/ling-3.0-flash-fin:free', name: 'Ling 3.0 Flash Fin (free)', type: ['chat', 'reasoning'], contextWindow: 262144, description: 'Free tier. Finance tuned', free: true },
            { id: 'nex-agi/nex-n2.5-pro:free', name: 'Nex N2.5 Pro (free)', type: ['chat', 'reasoning', 'vision'], contextWindow: 262144, description: 'Free tier. Larger Nex model; reads images', free: true },
            { id: 'nex-agi/nex-n2.5-mini:free', name: 'Nex N2.5 Mini (free)', type: ['chat', 'reasoning', 'vision'], contextWindow: 262144, description: 'Free tier. Fast Nex model; reads images', free: true },
            // Also available direct from Google (google:gemma-4-*), which is not
            // subject to OpenRouter's account cap and is the better route when
            // these 429 — they do so often.
            { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (free)', type: ['chat', 'reasoning'], contextWindow: 262144, description: 'Free tier. Open-weight 31B model; often rate-limited — the Gemma 4 31B listing is the more reliable route', free: true },
            { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B (free)', type: ['chat', 'reasoning'], contextWindow: 262144, description: 'Free tier. Open-weight 26B MoE; often rate-limited — the Gemma 4 26B A4B listing is the more reliable route', free: true },
            { id: 'cohere/north-mini-code:free', name: 'North Mini Code (free)', type: ['code', 'chat'], contextWindow: 256000, description: 'Free tier. Code-specialised', free: true },
            { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots 3 Note Preview (free)', type: ['chat', 'reasoning', 'vision'], contextWindow: 512000, description: 'Free tier. 512k context; reads images', free: true },
            { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM 2.5 2.6B (free)', type: ['chat'], contextWindow: 65536, description: 'Free tier. Tiny, cheapest to run', free: true },

            // Removed 2026-09-10 after they began 404ing upstream:
            // nvidia/nemotron-nano-12b-v2-vl:free, nvidia/nemotron-nano-9b-v2:free,
            // nvidia/nemotron-3-nano-30b-a3b:free, openai/gpt-oss-20b:free, and
            // stealth/ox-alpha — the anonymous preview ended, exactly as its note
            // here predicted it would.
            //
            // Not listed: thinkingmachines/inkling:free and inkling-small:free.
            // They are priced $0 but 403 with "only available on agentic
            // harnesses", so they are not callable through a gateway.
        ],
    },
    {
        id: 'xai',
        name: 'xAI',
        icon: '/providers/xai.svg',
        website: 'https://x.ai',
        docsUrl: 'https://docs.x.ai',
        keyPrefix: 'xai-',
        models: [
            // Grok 4.6 (August 2026)
            { id: 'grok-4.6', name: 'Grok 4.6', type: ['reasoning', 'chat'], contextWindow: 500000, description: 'Frontier xAI reasoning model with text and image input' },
            // Grok 4.5 Series (July 2026)
            { id: 'grok-4.5', name: 'Grok 4.5', type: ['reasoning', 'chat'], contextWindow: 500000, description: 'Previous xAI flagship, same price as Grok 4.6' },
            // Grok 4.3 Series (April 2026)
            { id: 'grok-4.3', name: 'Grok 4.3', type: ['reasoning', 'chat'], contextWindow: 1000000, description: 'Long-context xAI reasoning model with text and image input' },
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
            { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', type: ['chat', 'reasoning', 'code'], contextWindow: 1000000, description: '1.6T total / 49B active params, flagship performance' },
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
            { id: 'gpt-oss-120b', name: 'GPT OSS 120B (Cerebras)', type: ['chat'], contextWindow: 131072, description: '120B open model, 3000 tok/s inference' },
            { id: 'gemma-4-31b', name: 'Gemma 4 31B (Cerebras)', type: ['chat', 'vision'], contextWindow: 131072, description: 'Multimodal production model on Cerebras' },
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
            { id: 'maximo-atlas-1.2', name: 'Maximo Atlas 1.2', type: ['chat', 'reasoning', 'code', 'vision'], contextWindow: 1000000, description: 'Agentic coding & debugging across large codebases, image input, 1M context / 128K max output, prompt caching, reasoning low→max. $0.11/$0.01 cached/$0.30 per 1M through 2026-08-31 UTC, then $0.55/$0.05/$1.50' },
            { id: 'maximo-atlas-1.1', name: 'Maximo Atlas 1.1', type: ['chat', 'reasoning', 'code', 'vision'], contextWindow: 1000000, description: 'Agentic coding model, multiple specialized models behind one endpoint, image input, 1M context / 128K max output, $0.20/$1.00 per 1M tokens' },
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
            { id: 'helix-advisor', name: 'Helix Advisor', type: ['chat', 'reasoning', 'code'], contextWindow: 128000, description: 'Autonomous engineering agent (advisor mode) by Launchverse — architecture, debugging, and planning guidance. Read-only.' },
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
