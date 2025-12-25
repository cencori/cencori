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
            { id: 'gpt-4o', name: 'GPT-4o', type: 'chat', contextWindow: 128000, description: 'Most capable model for complex tasks' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', type: 'chat', contextWindow: 128000, description: 'Fast and cost-effective' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', type: 'chat', contextWindow: 128000, description: 'Previous flagship model' },
            { id: 'o1', name: 'o1', type: 'reasoning', contextWindow: 128000, description: 'Advanced reasoning model' },
            { id: 'o1-mini', name: 'o1 Mini', type: 'reasoning', contextWindow: 128000, description: 'Fast reasoning model' },
            { id: 'o1-pro', name: 'o1 Pro', type: 'reasoning', contextWindow: 128000, description: 'Most capable reasoning' },
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
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', type: 'chat', contextWindow: 200000, description: 'Best balance of speed and capability' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', type: 'chat', contextWindow: 200000, description: 'Fastest Claude model' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', type: 'chat', contextWindow: 200000, description: 'Most capable for complex analysis' },
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
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', type: 'chat', contextWindow: 1000000, description: 'Latest fast model' },
            { id: 'gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Thinking', type: 'reasoning', contextWindow: 1000000, description: 'Reasoning variant' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', type: 'chat', contextWindow: 2000000, description: 'Largest context window' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', type: 'chat', contextWindow: 1000000, description: 'Fast and efficient' },
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
            { id: 'mistral-large-latest', name: 'Mistral Large', type: 'chat', contextWindow: 128000, description: 'Most capable Mistral model' },
            { id: 'mistral-medium-latest', name: 'Mistral Medium', type: 'chat', contextWindow: 32000, description: 'Balanced performance' },
            { id: 'mistral-small-latest', name: 'Mistral Small', type: 'chat', contextWindow: 32000, description: 'Fast and efficient' },
            { id: 'codestral-latest', name: 'Codestral', type: 'code', contextWindow: 32000, description: 'Specialized for code' },
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
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', type: 'chat', contextWindow: 128000, description: 'Latest Llama model' },
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
            { id: 'command-r-plus', name: 'Command R+', type: 'chat', contextWindow: 128000, description: 'Most capable Cohere model' },
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
            { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', type: 'chat', contextWindow: 128000, description: 'Fast Llama inference' },
            { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B', type: 'chat', contextWindow: 32000, description: 'Alibaba flagship' },
            { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', type: 'chat', contextWindow: 128000, description: 'DeepSeek latest' },
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
            { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large Online', type: 'search', contextWindow: 128000, description: 'Web-connected search' },
            { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small Online', type: 'search', contextWindow: 128000, description: 'Fast web search' },
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
            { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)', type: 'chat', contextWindow: 128000, description: 'Access any model' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (via OpenRouter)', type: 'chat', contextWindow: 200000, description: 'Unified billing' },
            { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro (via OpenRouter)', type: 'chat', contextWindow: 2000000, description: 'Meta-provider' },
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
            { id: 'grok-2', name: 'Grok 2', type: 'chat', contextWindow: 128000, description: 'Most capable Grok model' },
            { id: 'grok-2-mini', name: 'Grok 2 Mini', type: 'chat', contextWindow: 128000, description: 'Fast and efficient' },
            { id: 'grok-vision-beta', name: 'Grok Vision', type: 'chat', contextWindow: 8192, description: 'Multimodal understanding' },
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
            { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', type: 'chat', contextWindow: 128000, description: 'Latest flagship model' },
            { id: 'llama-3.2-90b-vision', name: 'Llama 3.2 90B Vision', type: 'chat', contextWindow: 128000, description: 'Multimodal understanding' },
            { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', type: 'chat', contextWindow: 128000, description: 'Largest open model' },
            { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', type: 'chat', contextWindow: 128000, description: 'Balanced performance' },
            { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', type: 'chat', contextWindow: 128000, description: 'Fast and efficient' },
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
            { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', type: 'chat', contextWindow: 128000, description: 'Via HF Inference' },
            { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', type: 'chat', contextWindow: 32000, description: 'Via HF Inference' },
            { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', type: 'chat', contextWindow: 32000, description: 'Via HF Inference' },
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
            { id: 'deepseek-chat', name: 'DeepSeek V3', type: 'chat', contextWindow: 64000, description: 'Latest chat model' },
            { id: 'deepseek-reasoner', name: 'DeepSeek R1', type: 'reasoning', contextWindow: 64000, description: 'Reasoning model' },
            { id: 'deepseek-coder', name: 'DeepSeek Coder', type: 'code', contextWindow: 64000, description: 'Code specialized' },
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
