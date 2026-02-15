import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { decryptApiKey } from '@/lib/encryption';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
} from '@/lib/gateway-middleware';

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
    'gpt-image-1.5': { provider: 'openai' as const, apiModel: 'gpt-image-1.5', description: 'Best text rendering, top ELO rating' },
    'gpt-image-1': { provider: 'openai' as const, apiModel: 'gpt-image-1', description: 'ChatGPT image generation' },
    'dall-e-3': { provider: 'openai' as const, apiModel: 'dall-e-3', description: 'High quality, creative' },
    'dall-e-2': { provider: 'openai' as const, apiModel: 'dall-e-2', description: 'Fast, cost-effective' },
    'gemini-3-pro-image': { provider: 'google' as const, apiModel: 'gemini-2.0-flash-preview-image-generation', description: 'High photorealism, fast' },
    'nano-banana-pro': { provider: 'google' as const, apiModel: 'gemini-2.0-flash-preview-image-generation', description: 'Alias for Gemini 3 Pro Image' },
    'imagen-3': { provider: 'google' as const, apiModel: 'imagen-3.0-generate-002', description: 'Google Imagen 3' },
} as const;

type SupportedModel = keyof typeof IMAGE_MODELS;

function getProviderForModel(model: string): ImageProvider {
    const modelLower = model.toLowerCase().replace(/\s+/g, '-');
    if (modelLower in IMAGE_MODELS) return IMAGE_MODELS[modelLower as SupportedModel].provider;
    if (modelLower.includes('gemini') || modelLower.includes('imagen') || modelLower.includes('nano-banana')) return 'google';
    if (modelLower.includes('dall-e') || modelLower.includes('dalle') || modelLower.includes('gpt-image')) return 'openai';
    return 'openai';
}

function normalizeModelName(model: string): { normalized: string; apiModel: string } {
    const modelLower = model.toLowerCase().replace(/\s+/g, '-');
    if (modelLower in IMAGE_MODELS) {
        const config = IMAGE_MODELS[modelLower as SupportedModel];
        return { normalized: modelLower, apiModel: config.apiModel };
    }
    if (modelLower === 'dalle-3' || modelLower === 'dalle3') return { normalized: 'dall-e-3', apiModel: 'dall-e-3' };
    if (modelLower === 'dalle-2' || modelLower === 'dalle2') return { normalized: 'dall-e-2', apiModel: 'dall-e-2' };
    if (modelLower.includes('gpt') && modelLower.includes('image') && modelLower.includes('1.5')) return { normalized: 'gpt-image-1.5', apiModel: 'gpt-image-1.5' };
    if (modelLower.includes('gpt') && modelLower.includes('image')) return { normalized: 'gpt-image-1', apiModel: 'gpt-image-1' };
    if (modelLower.includes('gemini') && modelLower.includes('image')) return { normalized: 'gemini-3-pro-image', apiModel: 'gemini-2.0-flash-preview-image-generation' };
    if (modelLower.includes('nano') || modelLower.includes('banana')) return { normalized: 'nano-banana-pro', apiModel: 'gemini-2.0-flash-preview-image-generation' };
    if (modelLower.includes('imagen')) return { normalized: 'imagen-3', apiModel: 'imagen-3.0-generate-002' };
    return { normalized: model, apiModel: model };
}

async function generateWithOpenAI(client: OpenAI, request: ImageGenerationRequest, apiModel: string): Promise<ImageGenerationResponse> {
    const isGptImage = apiModel.startsWith('gpt-image');
    const response = await client.images.generate({
        model: apiModel,
        prompt: request.prompt,
        n: isGptImage ? 1 : (request.n ?? 1),
        size: request.size || '1024x1024',
        quality: isGptImage ? undefined : request.quality,
        style: isGptImage ? undefined : request.style,
        response_format: isGptImage ? 'b64_json' : (request.responseFormat || 'url'),
    });
    return {
        images: (response.data ?? []).map(item => ({
            url: item.url,
            b64_json: item.b64_json,
            revisedPrompt: item.revised_prompt,
        })),
        model: apiModel,
        provider: 'openai',
    };
}

async function generateWithGoogle(apiKey: string, request: ImageGenerationRequest, apiModel: string): Promise<ImageGenerationResponse> {
    const genAI = new GoogleGenAI({ apiKey });
    const aspectRatio = getSizeAsAspectRatio(request.size);
    const response = await genAI.models.generateContent({
        model: apiModel,
        contents: request.prompt,
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(apiModel.includes('imagen') ? {} : {}),
        },
    });
    const images: GeneratedImage[] = [];
    if (response.candidates) {
        for (const candidate of response.candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        images.push({ b64_json: part.inlineData.data });
                    }
                }
            }
        }
    }
    return { images, model: apiModel, provider: 'google' };
}

function getSizeAsAspectRatio(size?: string): '1:1' | '16:9' | '9:16' | '4:3' | '3:4' {
    switch (size) {
        case '1024x1792': case '1024x1536': return '9:16';
        case '1792x1024': case '1536x1024': return '16:9';
        default: return '1:1';
    }
}

// Fixed image pricing (per image)
const IMAGE_PRICING: Record<string, number> = {
    'dall-e-3': 0.04,      // $0.04/image standard 1024x1024
    'dall-e-2': 0.02,      // $0.02/image 1024x1024
    'gpt-image-1': 0.04,
    'gpt-image-1.5': 0.06,
    'gemini-3-pro-image': 0.02,
    'nano-banana-pro': 0.02,
    'imagen-3': 0.03,
};

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    // ── Gateway validation ──
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;

    try {
        const body = await req.json() as ImageGenerationRequest;
        const { prompt, model: requestedModel } = body;

        if (!prompt) {
            return addGatewayHeaders(
                NextResponse.json({ error: 'Missing required field: prompt' }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        const { normalized: model, apiModel } = normalizeModelName(requestedModel || 'dall-e-3');
        const provider = getProviderForModel(model);

        // Get API key for provider (BYOK or default)
        let providerApiKey: string | undefined;

        const { data: providerKey } = await ctx.supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', ctx.projectId)
            .eq('provider', provider)
            .single();

        if (providerKey?.is_active && providerKey.encrypted_key) {
            providerApiKey = decryptApiKey(providerKey.encrypted_key, ctx.organizationId);
        } else {
            if (provider === 'openai') providerApiKey = process.env.OPENAI_API_KEY;
            else if (provider === 'google') providerApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        }

        if (!providerApiKey) {
            return addGatewayHeaders(
                NextResponse.json({
                    error: `No API key configured for ${provider}`,
                    message: `Please add your ${provider} API key in project settings.`,
                    supportedModels: Object.entries(IMAGE_MODELS)
                        .filter(([, config]) => config.provider === provider)
                        .map(([name, config]) => ({ name, description: config.description })),
                }, { status: 400 }),
                { requestId: ctx.requestId }
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
            return addGatewayHeaders(
                NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 }),
                { requestId: ctx.requestId }
            );
        }

        // Cost tracking (fixed per-image pricing)
        const numImages = result.images.length || 1;
        const pricePerImage = IMAGE_PRICING[model] || 0.04;
        const providerCost = numImages * pricePerImage;
        const cencoriCharge = providerCost * 1.2; // 20% markup

        await logGatewayRequest(ctx, {
            endpoint: 'images/generate',
            model,
            provider,
            status: 'success',
            costUsd: cencoriCharge,
            providerCostUsd: providerCost,
            cencoriChargeUsd: cencoriCharge,
            markupPercentage: 20,
            metadata: { prompt: prompt.substring(0, 1000), numImages },
        });
        await incrementUsage(ctx);

        return addGatewayHeaders(
            NextResponse.json(result),
            { requestId: ctx.requestId }
        );

    } catch (error) {
        console.error('[ImageGeneration] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'images/generate',
            model: 'unknown',
            provider: 'unknown',
            status: 'error',
            errorMessage,
        });

        return addGatewayHeaders(
            NextResponse.json({ error: 'Image generation failed', message: errorMessage }, { status: 500 }),
            { requestId: ctx.requestId }
        );
    }
}

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
