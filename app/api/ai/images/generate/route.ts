/**
 * Image Generation API Route
 * 
 * POST /api/ai/images/generate
 * 
 * Generates images using AI models:
 * - OpenAI: GPT Image 1.5, DALL-E 3, DALL-E 2
 * - Google: Gemini 3 Pro Image (Nano Banana Pro)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { decryptApiKey } from '@/lib/encryption';

// Supported image generation providers
type ImageProvider = 'openai' | 'google';

interface ImageGenerationRequest {
    prompt: string;
    model?: string;
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024' | '1536x1024' | '1024x1536';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    responseFormat?: 'url' | 'b64_json';
}

interface GeneratedImage {
    url?: string;
    b64_json?: string;
    revisedPrompt?: string;
}

interface ImageGenerationResponse {
    images: GeneratedImage[];
    model: string;
    provider: string;
}

// Supported models with metadata
const IMAGE_MODELS = {
    // OpenAI models
    'gpt-image-1.5': { provider: 'openai' as const, apiModel: 'gpt-image-1.5', description: 'Best text rendering, top ELO rating' },
    'gpt-image-1': { provider: 'openai' as const, apiModel: 'gpt-image-1', description: 'ChatGPT image generation' },
    'dall-e-3': { provider: 'openai' as const, apiModel: 'dall-e-3', description: 'High quality, creative' },
    'dall-e-2': { provider: 'openai' as const, apiModel: 'dall-e-2', description: 'Fast, cost-effective' },
    // Google models
    'gemini-3-pro-image': { provider: 'google' as const, apiModel: 'gemini-2.0-flash-preview-image-generation', description: 'High photorealism, fast' },
    'nano-banana-pro': { provider: 'google' as const, apiModel: 'gemini-2.0-flash-preview-image-generation', description: 'Alias for Gemini 3 Pro Image' },
    'imagen-3': { provider: 'google' as const, apiModel: 'imagen-3.0-generate-002', description: 'Google Imagen 3' },
} as const;

type SupportedModel = keyof typeof IMAGE_MODELS;

// Model to provider mapping
function getProviderForModel(model: string): ImageProvider {
    const modelLower = model.toLowerCase().replace(/\s+/g, '-');

    // Check exact match first
    if (modelLower in IMAGE_MODELS) {
        return IMAGE_MODELS[modelLower as SupportedModel].provider;
    }

    // Fuzzy matching
    if (modelLower.includes('gemini') || modelLower.includes('imagen') || modelLower.includes('nano-banana')) {
        return 'google';
    }
    if (modelLower.includes('dall-e') || modelLower.includes('dalle') || modelLower.includes('gpt-image')) {
        return 'openai';
    }

    // Default to OpenAI
    return 'openai';
}

// Normalize model name to API model
function normalizeModelName(model: string): { normalized: string; apiModel: string } {
    const modelLower = model.toLowerCase().replace(/\s+/g, '-');

    // Check exact match
    if (modelLower in IMAGE_MODELS) {
        const config = IMAGE_MODELS[modelLower as SupportedModel];
        return { normalized: modelLower, apiModel: config.apiModel };
    }

    // Fuzzy matching for OpenAI
    if (modelLower === 'dalle-3' || modelLower === 'dalle3') {
        return { normalized: 'dall-e-3', apiModel: 'dall-e-3' };
    }
    if (modelLower === 'dalle-2' || modelLower === 'dalle2') {
        return { normalized: 'dall-e-2', apiModel: 'dall-e-2' };
    }
    if (modelLower.includes('gpt') && modelLower.includes('image') && modelLower.includes('1.5')) {
        return { normalized: 'gpt-image-1.5', apiModel: 'gpt-image-1.5' };
    }
    if (modelLower.includes('gpt') && modelLower.includes('image')) {
        return { normalized: 'gpt-image-1', apiModel: 'gpt-image-1' };
    }

    // Fuzzy matching for Google
    if (modelLower.includes('gemini') && modelLower.includes('image')) {
        return { normalized: 'gemini-3-pro-image', apiModel: 'gemini-2.0-flash-preview-image-generation' };
    }
    if (modelLower.includes('nano') || modelLower.includes('banana')) {
        return { normalized: 'nano-banana-pro', apiModel: 'gemini-2.0-flash-preview-image-generation' };
    }
    if (modelLower.includes('imagen')) {
        return { normalized: 'imagen-3', apiModel: 'imagen-3.0-generate-002' };
    }

    // Default
    return { normalized: model, apiModel: model };
}

// Generate images using OpenAI
async function generateWithOpenAI(
    client: OpenAI,
    request: ImageGenerationRequest,
    apiModel: string
): Promise<ImageGenerationResponse> {
    // GPT Image 1.5 and GPT Image 1 use a different endpoint pattern
    const isGptImage = apiModel.startsWith('gpt-image');

    const response = await client.images.generate({
        model: apiModel,
        prompt: request.prompt,
        n: isGptImage ? 1 : (request.n ?? 1), // GPT Image models only support n=1
        size: request.size ?? '1024x1024',
        quality: (apiModel === 'dall-e-3' || isGptImage) ? (request.quality ?? 'standard') : undefined,
        style: apiModel === 'dall-e-3' ? (request.style ?? 'vivid') : undefined,
        response_format: request.responseFormat ?? 'url',
    });

    return {
        images: (response.data ?? []).map(img => ({
            url: img.url,
            b64_json: img.b64_json,
            revisedPrompt: img.revised_prompt,
        })),
        model: apiModel,
        provider: 'openai',
    };
}

// Generate images using Google Gemini
async function generateWithGoogle(
    apiKey: string,
    request: ImageGenerationRequest,
    apiModel: string
): Promise<ImageGenerationResponse> {
    const genAI = new GoogleGenAI({ apiKey });

    // Use the Gemini image generation API
    const response = await genAI.models.generateImages({
        model: apiModel,
        prompt: request.prompt,
        config: {
            numberOfImages: request.n ?? 1,
            aspectRatio: getSizeAsAspectRatio(request.size),
        },
    });

    const images: GeneratedImage[] = [];

    if (response.generatedImages) {
        for (const img of response.generatedImages) {
            if (img.image?.imageBytes) {
                images.push({
                    b64_json: img.image.imageBytes,
                });
            }
        }
    }

    return {
        images,
        model: apiModel,
        provider: 'google',
    };
}

// Convert size to aspect ratio for Google
function getSizeAsAspectRatio(size?: string): '1:1' | '16:9' | '9:16' | '4:3' | '3:4' {
    switch (size) {
        case '1024x1792':
        case '1024x1536':
            return '9:16';
        case '1792x1024':
        case '1536x1024':
            return '16:9';
        default:
            return '1:1';
    }
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const supabase = createAdminClient();

    try {
        // Authenticate
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing CENCORI_API_KEY header' },
                { status: 401 }
            );
        }

        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
                id,
                project_id,
                projects!inner(
                    id,
                    organization_id,
                    organizations!inner(
                        id,
                        subscription_tier,
                        monthly_requests_used,
                        monthly_request_limit
                    )
                )
            `)
            .eq('key_hash', keyHash)
            .is('revoked_at', null)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        const project = keyData.projects as unknown as {
            id: string;
            organization_id: string;
            organizations: {
                id: string;
                subscription_tier: string;
                monthly_requests_used: number;
                monthly_request_limit: number;
            };
        };

        const organization = project.organizations;
        const organizationId = organization.id;

        // Check rate limits
        const currentUsage = organization.monthly_requests_used || 0;
        const limit = organization.monthly_request_limit || 1000;

        if (currentUsage >= limit) {
            return NextResponse.json(
                {
                    error: 'Monthly request limit reached',
                    current_tier: organization.subscription_tier,
                },
                { status: 429 }
            );
        }

        // Parse request body
        const body = await req.json() as ImageGenerationRequest;
        const { prompt, model: requestedModel } = body;

        if (!prompt) {
            return NextResponse.json(
                { error: 'Missing required field: prompt' },
                { status: 400 }
            );
        }

        const { normalized: model, apiModel } = normalizeModelName(requestedModel || 'dall-e-3');
        const provider = getProviderForModel(model);

        // Get API key for provider (BYOK or default)
        let providerApiKey: string | undefined;

        // Try BYOK first
        const { data: providerKey } = await supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', project.id)
            .eq('provider', provider)
            .single();

        if (providerKey?.is_active && providerKey.encrypted_key) {
            providerApiKey = decryptApiKey(providerKey.encrypted_key, organizationId);
        } else {
            // Fall back to environment variable
            if (provider === 'openai') {
                providerApiKey = process.env.OPENAI_API_KEY;
            } else if (provider === 'google') {
                providerApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
            }
        }

        if (!providerApiKey) {
            return NextResponse.json(
                {
                    error: `No API key configured for ${provider}`,
                    message: `Please add your ${provider} API key in project settings.`,
                    supportedModels: Object.entries(IMAGE_MODELS)
                        .filter(([, config]) => config.provider === provider)
                        .map(([name, config]) => ({ name, description: config.description })),
                },
                { status: 400 }
            );
        }

        // Generate images
        let result: ImageGenerationResponse;

        if (provider === 'openai') {
            const client = new OpenAI({ apiKey: providerApiKey });
            result = await generateWithOpenAI(client, body, apiModel);
        } else if (provider === 'google') {
            result = await generateWithGoogle(providerApiKey, body, apiModel);
        } else {
            return NextResponse.json(
                { error: `Unsupported provider: ${provider}` },
                { status: 400 }
            );
        }

        // Log the request
        const latencyMs = Date.now() - startTime;

        await supabase.from('ai_requests').insert({
            project_id: project.id,
            api_key_id: keyData.id,
            model,
            provider,
            request_type: 'image_generation',
            input_text: prompt.substring(0, 1000),
            latency_ms: latencyMs,
            status: 'success',
        });

        // Increment usage
        await supabase.rpc('increment_monthly_usage', {
            org_id: organizationId,
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('[ImageGeneration] Error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: 'Image generation failed', message: errorMessage },
            { status: 500 }
        );
    }
}

// GET endpoint to list supported models
export async function GET() {
    const models = Object.entries(IMAGE_MODELS).map(([name, config]) => ({
        name,
        provider: config.provider,
        description: config.description,
    }));

    return NextResponse.json({
        models,
        providers: ['openai', 'google'],
        note: 'Midjourney V7 is not supported as it lacks API access.',
    });
}
