/**
 * Provider Router
 * 
 * Routes AI requests to the appropriate provider based on model name
 */

import { AIProvider } from './base';
import { ProviderError } from './errors';

/**
 * Provider Router Class
 * Manages provider instances and routes requests to the correct provider
 */
export class ProviderRouter {
    private providers: Map<string, AIProvider> = new Map();

    /**
     * Register a provider instance
     */
    registerProvider(name: string, provider: AIProvider): void {
        this.providers.set(name, provider);
    }

    /**
     * Auto-detect provider from model name
     * Returns the provider identifier
     */
    detectProvider(modelName: string): string {
        // OpenAI models
        if (modelName.startsWith('gpt-') ||
            modelName.startsWith('o1-') ||
            modelName.startsWith('text-') ||
            modelName.startsWith('davinci-')) {
            return 'openai';
        }

        // Anthropic models
        if (modelName.startsWith('claude-')) {
            return 'anthropic';
        }

        // Google models
        if (modelName.startsWith('gemini-')) {
            return 'google';
        }

        // Mistral models
        if (modelName.startsWith('mistral-') ||
            modelName.startsWith('codestral-') ||
            modelName.startsWith('open-mistral-') ||
            modelName.startsWith('open-mixtral-')) {
            return 'mistral';
        }

        // Groq models (Llama, Mixtral, Gemma via Groq)
        if (modelName.startsWith('llama-') ||
            modelName.startsWith('llama2-') ||
            modelName.startsWith('llama3-') ||
            modelName.includes('llama') ||
            modelName.startsWith('mixtral-')) {
            return 'groq';
        }

        // Cohere models
        if (modelName.startsWith('command-')) {
            return 'cohere';
        }

        // xAI models
        if (modelName.startsWith('grok-')) {
            return 'xai';
        }

        // DeepSeek models
        if (modelName.startsWith('deepseek-')) {
            return 'deepseek';
        }

        // Perplexity models
        if (modelName.includes('sonar')) {
            return 'perplexity';
        }

        // Qwen models
        if (modelName.startsWith('qwen-') || modelName.includes('qwen')) {
            return 'qwen';
        }

        // Explicit provider prefix format: "provider/model"
        // e.g., "openai/gpt-4", "anthropic/claude-3-opus"
        if (modelName.includes('/')) {
            const [provider] = modelName.split('/');
            return provider;
        }

        // Custom provider format: "custom-{name}"
        if (modelName.startsWith('custom-')) {
            return modelName;
        }

        // Default to OpenAI for unknown models
        return 'openai';
    }

    /**
     * Get provider instance by name
     */
    getProvider(providerName: string): AIProvider {
        const provider = this.providers.get(providerName);

        if (!provider) {
            throw new ProviderError(
                providerName,
                `Provider '${providerName}' is not registered or not available.`,
                undefined,
                false
            );
        }

        return provider;
    }

    /**
     * Get provider for a specific model
     * Automatically detects the provider from the model name
     */
    getProviderForModel(modelName: string): AIProvider {
        const providerName = this.detectProvider(modelName);
        return this.getProvider(providerName);
    }

    /**
     * Check if a provider is registered
     */
    hasProvider(providerName: string): boolean {
        return this.providers.has(providerName);
    }

    /**
     * Get list of all registered providers
     */
    getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Normalize model name
     * If model has provider prefix, extract just the model name
     */
    normalizeModelName(modelName: string): string {
        if (modelName.includes('/')) {
            const [, model] = modelName.split('/');
            return model;
        }
        return modelName;
    }
}

/**
 * Create a default router instance with lazy-loaded providers
 * Providers are only instantiated when first accessed
 */
export function createDefaultRouter(): ProviderRouter {
    const router = new ProviderRouter();

    // Providers will be registered lazily when needed
    // This avoids loading all provider SDKs upfront

    return router;
}
