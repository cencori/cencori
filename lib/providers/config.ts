/**
 * Supported AI Providers and Models
 * 
 * This file defines all providers supported by Cencori
 * with their available models and metadata.
 */

export interface AIModel {
    id: string;
    name: string;
    type: 'chat' | 'reasoning' | 'code' | 'search' | 'embedding';
    contextWindow: number;
    description?: string;
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
        id: 'openai',
        name: 'OpenAI',
        icon: '/providers/openai.svg',
        website: 'https://openai.com',
        docsUrl: 'https://platform.openai.com/docs',
        keyPrefix: 'sk-',
        models: [
            // GPT-5 Series (2025)
            { id: 'gpt-5', name: 'GPT-5', type: 'chat', contextWindow: 256000, description: 'Latest flagship model' },
            { id: 'gpt-5-mini', name: 'GPT-5 Mini', type: 'chat', contextWindow: 128000, description: 'Fast and efficient' },
            // GPT-4 Series
            { id: 'gpt-4o', name: 'GPT-4o', type: 'chat', contextWindow: 128000, description: 'Omni-modal model' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', type: 'chat', contextWindow: 128000, description: 'Fast and cost-effective' },
            { id: 'gpt-4.1', name: 'GPT-4.1', type: 'code', contextWindow: 256000, description: 'Long context, code-optimized' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', type: 'chat', contextWindow: 128000, description: 'Previous flagship' },
            // O-Series Reasoning (2025)
            { id: 'o3', name: 'o3', type: 'reasoning', contextWindow: 200000, description: 'Most advanced reasoning' },
            { id: 'o3-mini', name: 'o3 Mini', type: 'reasoning', contextWindow: 128000, description: 'Fast reasoning model' },
            { id: 'o1', name: 'o1', type: 'reasoning', contextWindow: 128000, description: 'Advanced reasoning model' },
            { id: 'o1-mini', name: 'o1 Mini', type: 'reasoning', contextWindow: 128000, description: 'Efficient reasoning' },
        ],
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        icon: '/providers/anthropic.svg',
        website: 'https://anthropic.com',
        docsUrl: 'https://docs.anthropic.com',
        keyPrefix: 'sk-ant-',
        models: [
            // Claude 4 Series (2025)
            { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', type: 'chat', contextWindow: 1000000, description: 'Latest flagship, agentic coding record-breaker' },
            { id: 'claude-opus-4', name: 'Claude Opus 4', type: 'chat', contextWindow: 200000, description: 'Most capable Claude model' },
            { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', type: 'chat', contextWindow: 200000, description: 'Balanced speed & capability' },
            { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', type: 'chat', contextWindow: 200000, description: 'Enhanced coding & agents' },
            { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', type: 'chat', contextWindow: 200000, description: 'Latest, most intelligent' },
            { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', type: 'chat', contextWindow: 200000, description: 'Fastest Claude model' },
            // Claude 3.5/3.7 Series
            { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', type: 'reasoning', contextWindow: 200000, description: 'Hybrid reasoning model' },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', type: 'chat', contextWindow: 200000, description: 'Balance of speed and capability' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', type: 'chat', contextWindow: 200000, description: 'Fast and efficient' },
        ],
    },
    {
        id: 'google',
        name: 'Google AI',
        icon: '/providers/google.svg',
        website: 'https://ai.google.dev',
        docsUrl: 'https://ai.google.dev/docs',
        keyPrefix: 'AIza',
        models: [
            // Gemini 3 Series (Late 2025)
            { id: 'gemini-3-pro', name: 'Gemini 3 Pro', type: 'chat', contextWindow: 2000000, description: 'Most powerful Gemini' },
            { id: 'gemini-3-flash', name: 'Gemini 3 Flash', type: 'chat', contextWindow: 1000000, description: 'Frontier speed & intelligence' },
            { id: 'gemini-3-deep-think', name: 'Gemini 3 Deep Think', type: 'reasoning', contextWindow: 1000000, description: 'Deep iterative reasoning' },
            // Gemini 2.5 Series (Mid 2025)
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: 'chat', contextWindow: 1000000, description: 'Enhanced reasoning & coding' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'chat', contextWindow: 1000000, description: 'Thinking capabilities' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', type: 'chat', contextWindow: 1000000, description: 'Speed optimized' },
            // Gemini 2.0 Series
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', type: 'chat', contextWindow: 1000000, description: 'Fast model' },
            { id: 'gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Thinking', type: 'reasoning', contextWindow: 1000000, description: 'Reasoning variant' },
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
            { id: 'mistral-large-latest', name: 'Mistral Large 3', type: 'chat', contextWindow: 128000, description: '675B params, best open-weight multimodal' },
            { id: 'mistral-medium-latest', name: 'Mistral Medium 3.1', type: 'chat', contextWindow: 128000, description: 'Frontier-class multimodal' },
            { id: 'mistral-small-latest', name: 'Mistral Small 3', type: 'chat', contextWindow: 32000, description: '24B params, fast' },
            // Ministral (Dec 2025)
            { id: 'ministral-3b', name: 'Ministral 3B', type: 'chat', contextWindow: 128000, description: 'Compact edge model' },
            { id: 'ministral-8b', name: 'Ministral 8B', type: 'chat', contextWindow: 128000, description: 'Small efficient model' },
            // Code Models
            { id: 'codestral-latest', name: 'Codestral 25.01', type: 'code', contextWindow: 256000, description: '2.5x faster code generation' },
            { id: 'devstral-latest', name: 'Devstral 2', type: 'code', contextWindow: 256000, description: 'Frontier code agents' },
            // Reasoning
            { id: 'magistral-medium', name: 'Magistral Medium', type: 'reasoning', contextWindow: 128000, description: 'Multimodal reasoning' },
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
            // Llama 4 via Groq (2025)
            { id: 'llama-4-maverick', name: 'Llama 4 Maverick', type: 'chat', contextWindow: 256000, description: 'Latest multimodal Llama' },
            { id: 'llama-4-scout', name: 'Llama 4 Scout', type: 'chat', contextWindow: 256000, description: 'Advanced Llama 4 model' },
            // Llama 3.3
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', type: 'chat', contextWindow: 128000, description: 'Latest Llama 3 model' },
            { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', type: 'chat', contextWindow: 128000, description: 'Ultra-fast inference' },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', type: 'chat', contextWindow: 32768, description: 'MoE architecture' },
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
            { id: 'command-a-03-2025', name: 'Command A', type: 'chat', contextWindow: 256000, description: 'Most performant, agentic tasks' },
            // Command R+ (Aug 2024 update)
            { id: 'command-r-plus-08-2024', name: 'Command R+', type: 'chat', contextWindow: 128000, description: 'Complex RAG and multi-step' },
            { id: 'command-r', name: 'Command R', type: 'chat', contextWindow: 128000, description: 'Balanced performance' },
            { id: 'command-light', name: 'Command Light', type: 'chat', contextWindow: 4096, description: 'Fast and efficient' },
        ],
    },
    {
        id: 'together',
        name: 'Together AI',
        icon: '/providers/together.svg',
        website: 'https://together.ai',
        docsUrl: 'https://docs.together.ai',
        keyPrefix: '',
        models: [
            // Llama 4
            { id: 'meta-llama/Llama-4-Maverick', name: 'Llama 4 Maverick', type: 'chat', contextWindow: 256000, description: 'Latest Llama' },
            { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', type: 'chat', contextWindow: 128000, description: 'Fast Llama inference' },
            { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B', type: 'chat', contextWindow: 32000, description: 'Alibaba flagship' },
            { id: 'deepseek-ai/DeepSeek-V3.1', name: 'DeepSeek V3.1', type: 'chat', contextWindow: 128000, description: 'Hybrid reasoning' },
        ],
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
            { id: 'sonar-pro', name: 'Sonar Pro', type: 'search', contextWindow: 128000, description: 'Enhanced search, richer context' },
            { id: 'sonar', name: 'Sonar', type: 'search', contextWindow: 128000, description: 'Default web-connected' },
            { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', type: 'reasoning', contextWindow: 128000, description: 'Deep inference & research' },
            // Legacy
            { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large Online', type: 'search', contextWindow: 128000, description: 'Web-connected search' },
        ],
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        icon: '/providers/openrouter.svg',
        website: 'https://openrouter.ai',
        docsUrl: 'https://openrouter.ai/docs',
        keyPrefix: 'sk-or-',
        models: [
            { id: 'openai/gpt-5', name: 'GPT-5 (via OpenRouter)', type: 'chat', contextWindow: 256000, description: 'Access any model' },
            { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5 (via OpenRouter)', type: 'chat', contextWindow: 200000, description: 'Unified billing' },
            { id: 'google/gemini-3-pro', name: 'Gemini 3 Pro (via OpenRouter)', type: 'chat', contextWindow: 2000000, description: 'Meta-provider' },
            { id: 'x-ai/grok-4', name: 'Grok 4 (via OpenRouter)', type: 'chat', contextWindow: 256000, description: 'Access xAI models' },
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
            // Grok 4 Series (July-Nov 2025)
            { id: 'grok-4', name: 'Grok 4', type: 'chat', contextWindow: 256000, description: 'Enhanced reasoning, real-time search' },
            { id: 'grok-4.1', name: 'Grok 4.1', type: 'chat', contextWindow: 256000, description: 'Improved multimodal & reasoning' },
            { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast', type: 'chat', contextWindow: 2000000, description: 'Best agentic tool calling' },
            { id: 'grok-4-heavy', name: 'Grok 4 Heavy', type: 'chat', contextWindow: 256000, description: 'Maximum capability' },
            // Grok 3 Series
            { id: 'grok-3', name: 'Grok 3', type: 'chat', contextWindow: 128000, description: 'DeepSearch, Big Brain Mode' },
            { id: 'grok-3-mini', name: 'Grok 3 Mini', type: 'chat', contextWindow: 128000, description: 'Fast responses' },
            // Code
            { id: 'grok-code-fast-1', name: 'Grok Code Fast', type: 'code', contextWindow: 128000, description: 'Fast agentic coding' },
        ],
    },
    {
        id: 'meta',
        name: 'Meta AI',
        icon: '/providers/meta.svg',
        website: 'https://llama.meta.com',
        docsUrl: 'https://llama.meta.com/docs',
        keyPrefix: '',
        models: [
            // Llama 4 (2025)
            { id: 'llama-4-maverick', name: 'Llama 4 Maverick', type: 'chat', contextWindow: 256000, description: 'Latest multimodal flagship' },
            { id: 'llama-4-scout', name: 'Llama 4 Scout', type: 'chat', contextWindow: 256000, description: 'Advanced reasoning' },
            // Llama 3.3
            { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', type: 'chat', contextWindow: 128000, description: 'Latest Llama 3 model' },
            { id: 'llama-3.2-90b-vision', name: 'Llama 3.2 90B Vision', type: 'chat', contextWindow: 128000, description: 'Multimodal understanding' },
            { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', type: 'chat', contextWindow: 128000, description: 'Largest open model' },
            { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', type: 'chat', contextWindow: 128000, description: 'Balanced performance' },
        ],
    },
    {
        id: 'huggingface',
        name: 'Hugging Face',
        icon: '/providers/huggingface.svg',
        website: 'https://huggingface.co',
        docsUrl: 'https://huggingface.co/docs',
        keyPrefix: 'hf_',
        models: [
            { id: 'meta-llama/Llama-4-Maverick', name: 'Llama 4 Maverick', type: 'chat', contextWindow: 256000, description: 'Via HF Inference' },
            { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', type: 'chat', contextWindow: 128000, description: 'Via HF Inference' },
            { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', type: 'chat', contextWindow: 32000, description: 'Via HF Inference' },
            { id: 'mistralai/Mistral-Large-3', name: 'Mistral Large 3', type: 'chat', contextWindow: 128000, description: 'Via HF Inference' },
        ],
    },
    {
        id: 'qwen',
        name: 'Qwen',
        icon: '/providers/qwen.svg',
        website: 'https://qwenlm.ai',
        docsUrl: 'https://qwen.readthedocs.io',
        keyPrefix: '',
        models: [
            { id: 'qwen2.5-72b-instruct', name: 'Qwen 2.5 72B', type: 'chat', contextWindow: 128000, description: 'Flagship model' },
            { id: 'qwen2.5-32b-instruct', name: 'Qwen 2.5 32B', type: 'chat', contextWindow: 128000, description: 'Balanced performance' },
            { id: 'qwen2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', type: 'code', contextWindow: 128000, description: 'Code specialized' },
            { id: 'qwq-32b-preview', name: 'QwQ 32B', type: 'reasoning', contextWindow: 32000, description: 'Reasoning model' },
        ],
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        icon: '/providers/deepseek.svg',
        website: 'https://deepseek.com',
        docsUrl: 'https://platform.deepseek.com/docs',
        keyPrefix: 'sk-',
        models: [
            // V3.2 Series (Dec 2025)
            { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', type: 'chat', contextWindow: 128000, description: 'GPT-5 level, daily driver' },
            { id: 'deepseek-v3.2-speciale', name: 'DeepSeek V3.2 Speciale', type: 'reasoning', contextWindow: 128000, description: 'Maxed reasoning, competition gold' },
            // V3.1 (Aug 2025)
            { id: 'deepseek-v3.1', name: 'DeepSeek V3.1', type: 'chat', contextWindow: 128000, description: 'Hybrid thinking modes' },
            // V3 (March 2025 update)
            { id: 'deepseek-chat', name: 'DeepSeek V3', type: 'chat', contextWindow: 128000, description: '128K context, MIT license' },
            { id: 'deepseek-reasoner', name: 'DeepSeek R1', type: 'reasoning', contextWindow: 64000, description: 'Reasoning model' },
            // Coder
            { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', type: 'code', contextWindow: 128000, description: '338 languages, GPT-4 level' },
        ],
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
    if (modelId.startsWith('gpt-') || modelId.startsWith('o1')) return 'openai';
    if (modelId.startsWith('claude-')) return 'anthropic';
    if (modelId.startsWith('gemini-')) return 'google';
    if (modelId.startsWith('mistral-') || modelId.startsWith('codestral')) return 'mistral';
    if (modelId.includes('llama')) return 'groq';
    return undefined;
}
