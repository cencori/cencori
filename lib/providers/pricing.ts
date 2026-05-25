/**
 * Pricing Utilities
 * 
 * Functions for retrieving and managing AI model pricing
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { ModelPricing } from './base';

/**
 * Get pricing for a model from the database
 */
export async function getPricingFromDB(
    provider: string,
    model: string
): Promise<ModelPricing> {
    const FREE_MODELS = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant'
    ];
    
    // Intercept natively free models before any DB queries for 0-latency pricing
    if (FREE_MODELS.includes(model)) {
        return {
            inputPer1KTokens: 0,
            outputPer1KTokens: 0,
            cencoriMarkupPercentage: 0,
        };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('model_pricing')
        .select('*')
        .eq('provider', provider)
        .eq('model_name', model)
        .single();

    if (error || !data) {
        console.warn(`[Pricing] Pricing not found for ${provider}/${model}, using defaults`);
        return getDefaultPricing(provider);
    }

    return {
        inputPer1KTokens: parseFloat(data.input_price_per_1k_tokens),
        outputPer1KTokens: parseFloat(data.output_price_per_1k_tokens),
        cencoriMarkupPercentage: parseFloat(data.cencori_markup_percentage),
    };
}

/**
 * Get default pricing for a provider (fallback)
 */
function getDefaultPricing(provider: string): ModelPricing {
    const defaults: Record<string, ModelPricing> = {
        openai: {
            inputPer1KTokens: 0.0025,
            outputPer1KTokens: 0.015,
            cencoriMarkupPercentage: 50,
        },
        anthropic: {
            inputPer1KTokens: 0.003,
            outputPer1KTokens: 0.015,
            cencoriMarkupPercentage: 50,
        },
        google: {
            inputPer1KTokens: 0.00125,
            outputPer1KTokens: 0.01,
            cencoriMarkupPercentage: 0,
        },
        mistral: {
            inputPer1KTokens: 0.0004,
            outputPer1KTokens: 0.002,
            cencoriMarkupPercentage: 50,
        },
        cohere: {
            inputPer1KTokens: 0.0025,
            outputPer1KTokens: 0.01,
            cencoriMarkupPercentage: 50,
        },
        deepseek: {
            inputPer1KTokens: 0.00014,
            outputPer1KTokens: 0.00028,
            cencoriMarkupPercentage: 50,
        },
        xai: {
            inputPer1KTokens: 0.00125,
            outputPer1KTokens: 0.0025,
            cencoriMarkupPercentage: 50,
        },
        groq: {
            inputPer1KTokens: 0,
            outputPer1KTokens: 0,
            cencoriMarkupPercentage: 0,
        },
        custom: {
            inputPer1KTokens: 0,
            outputPer1KTokens: 0,
            cencoriMarkupPercentage: 0,
        },
    };

    return defaults[provider] || defaults.custom;
}

/**
 * Update pricing in database (admin function)
 */
export async function updatePricing(
    provider: string,
    model: string,
    pricing: Partial<ModelPricing>
): Promise<void> {
    const supabase = createAdminClient();

    await supabase
        .from('model_pricing')
        .upsert({
            provider,
            model_name: model,
            input_price_per_1k_tokens: pricing.inputPer1KTokens,
            output_price_per_1k_tokens: pricing.outputPer1KTokens,
            cencori_markup_percentage: pricing.cencoriMarkupPercentage,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'provider,model_name'
        });
}

/**
 * Get all pricing for a provider
 */
export async function getProviderPricing(provider: string): Promise<Record<string, ModelPricing>> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('model_pricing')
        .select('*')
        .eq('provider', provider);

    if (error || !data) {
        return {};
    }

    const pricing: Record<string, ModelPricing> = {};

    for (const row of data) {
        pricing[row.model_name] = {
            inputPer1KTokens: parseFloat(row.input_price_per_1k_tokens),
            outputPer1KTokens: parseFloat(row.output_price_per_1k_tokens),
            cencoriMarkupPercentage: parseFloat(row.cencori_markup_percentage),
        };
    }

    return pricing;
}
