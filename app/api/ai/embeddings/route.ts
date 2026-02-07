/**
 * Embeddings API Route
 * 
 * POST /api/ai/embeddings
 * 
 * Generates vector embeddings using AI models:
 * - OpenAI: text-embedding-3-large, text-embedding-3-small, text-embedding-ada-002
 * - Google: text-embedding-004
 * - Cohere: embed-english-v3.0, embed-multilingual-v3.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { decryptApiKey } from '@/lib/encryption';

// Supported embedding providers
type EmbeddingProvider = 'openai' | 'google' | 'cohere';

interface EmbeddingRequest {
    model?: string;
    input: string | string[];
    dimensions?: number;
    encodingFormat?: 'float' | 'base64';
}

interface EmbeddingResponse {
    data: Array<{
        embedding: number[];
        index: number;
    }>;
    model: string;
    provider: string;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}

// Supported models with metadata
const EMBEDDING_MODELS = {
    // OpenAI models
    'text-embedding-3-large': { provider: 'openai' as const, dimensions: 3072, description: 'Best quality' },
    'text-embedding-3-small': { provider: 'openai' as const, dimensions: 1536, description: 'Fast and efficient' },
    'text-embedding-ada-002': { provider: 'openai' as const, dimensions: 1536, description: 'Legacy model' },
    // Google models
    'text-embedding-004': { provider: 'google' as const, dimensions: 768, description: 'Google embedding model' },
    'embedding-001': { provider: 'google' as const, dimensions: 768, description: 'Legacy Google model' },
    // Cohere models
    'embed-english-v3.0': { provider: 'cohere' as const, dimensions: 1024, description: 'English optimized' },
    'embed-multilingual-v3.0': { provider: 'cohere' as const, dimensions: 1024, description: 'Multilingual' },
} as const;

type SupportedModel = keyof typeof EMBEDDING_MODELS;

// Get provider for model
function getProviderForModel(model: string): EmbeddingProvider {
    const modelLower = model.toLowerCase();

    if (modelLower in EMBEDDING_MODELS) {
        return EMBEDDING_MODELS[modelLower as SupportedModel].provider;
    }

    if (modelLower.includes('ada') || modelLower.includes('embedding-3')) {
        return 'openai';
    }
    if (modelLower.includes('embed-') && (modelLower.includes('english') || modelLower.includes('multilingual'))) {
        return 'cohere';
    }
    if (modelLower.includes('embedding-00')) {
        return 'google';
    }

    // Default to OpenAI
    return 'openai';
}

// Generate embeddings using OpenAI
async function generateWithOpenAI(
    client: OpenAI,
    request: EmbeddingRequest,
    model: string
): Promise<EmbeddingResponse> {
    const input = Array.isArray(request.input) ? request.input : [request.input];

    const response = await client.embeddings.create({
        model,
        input,
        dimensions: request.dimensions,
        encoding_format: request.encodingFormat,
    });

    return {
        data: response.data.map((item, idx) => ({
            embedding: item.embedding,
            index: idx,
        })),
        model: response.model,
        provider: 'openai',
        usage: {
            prompt_tokens: response.usage?.prompt_tokens ?? 0,
            total_tokens: response.usage?.total_tokens ?? 0,
        },
    };
}

// Generate embeddings using Google
async function generateWithGoogle(
    apiKey: string,
    request: EmbeddingRequest,
    model: string
): Promise<EmbeddingResponse> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model });

    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const results: Array<{ embedding: number[]; index: number }> = [];
    let totalTokens = 0;

    for (let i = 0; i < inputs.length; i++) {
        const result = await embeddingModel.embedContent(inputs[i]);
        results.push({
            embedding: result.embedding.values,
            index: i,
        });
        // Estimate tokens (Google doesn't return token count for embeddings)
        totalTokens += Math.ceil(inputs[i].length / 4);
    }

    return {
        data: results,
        model,
        provider: 'google',
        usage: {
            prompt_tokens: totalTokens,
            total_tokens: totalTokens,
        },
    };
}

// Generate embeddings using Cohere
async function generateWithCohere(
    apiKey: string,
    request: EmbeddingRequest,
    model: string
): Promise<EmbeddingResponse> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            texts: inputs,
            input_type: 'search_document',
            truncate: 'END',
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Cohere API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();

    return {
        data: data.embeddings.map((embedding: number[], idx: number) => ({
            embedding,
            index: idx,
        })),
        model,
        provider: 'cohere',
        usage: {
            prompt_tokens: data.meta?.billed_units?.input_tokens ?? 0,
            total_tokens: data.meta?.billed_units?.input_tokens ?? 0,
        },
    };
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
        // Get API key from header
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'unauthorized', message: 'Missing API key' },
                { status: 401 }
            );
        }

        // Parse request body
        const body: EmbeddingRequest = await req.json();
        const { input, model = 'text-embedding-3-small', dimensions, encodingFormat } = body;

        if (!input || (Array.isArray(input) && input.length === 0)) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Input is required' },
                { status: 400 }
            );
        }

        // Initialize Supabase client
        const supabase = createAdminClient();

        // Validate API key and get project
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select('id, project_id, key_type, is_active, projects(id, organization_id, name)')
            .eq('key_hash', crypto.createHash('sha256').update(apiKey).digest('hex'))
            .single();

        if (keyError || !keyData || !keyData.is_active) {
            return NextResponse.json(
                { error: 'unauthorized', message: 'Invalid or inactive API key' },
                { status: 401 }
            );
        }

        const projectId = keyData.project_id;
        const projectData = keyData.projects as unknown as { id: string; organization_id: string; name: string };

        // Determine provider
        const provider = getProviderForModel(model);

        // Get provider API key (BYOK or default)
        let providerApiKey: string | null = null;

        // Check for BYOK
        const { data: providerKey } = await supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', projectId)
            .eq('provider', provider)
            .eq('is_active', true)
            .single();

        if (providerKey?.encrypted_key) {
            providerApiKey = decryptApiKey(providerKey.encrypted_key, projectData.organization_id);
        } else {
            // Use default keys from environment
            switch (provider) {
                case 'openai':
                    providerApiKey = process.env.OPENAI_API_KEY ?? null;
                    break;
                case 'google':
                    providerApiKey = process.env.GOOGLE_AI_API_KEY ?? null;
                    break;
                case 'cohere':
                    providerApiKey = process.env.COHERE_API_KEY ?? null;
                    break;
            }
        }

        if (!providerApiKey) {
            return NextResponse.json(
                { error: 'provider_not_configured', message: `No API key configured for ${provider}` },
                { status: 400 }
            );
        }

        // Generate embeddings based on provider
        let result: EmbeddingResponse;

        switch (provider) {
            case 'openai': {
                const client = new OpenAI({ apiKey: providerApiKey });
                result = await generateWithOpenAI(client, { input, model, dimensions, encodingFormat }, model);
                break;
            }
            case 'google': {
                result = await generateWithGoogle(providerApiKey, { input, model, dimensions }, model);
                break;
            }
            case 'cohere': {
                result = await generateWithCohere(providerApiKey, { input, model, dimensions }, model);
                break;
            }
            default:
                return NextResponse.json(
                    { error: 'unsupported_provider', message: `Provider ${provider} not supported` },
                    { status: 400 }
                );
        }

        const latencyMs = Date.now() - startTime;

        // Log the request
        await supabase.from('ai_requests').insert({
            id: requestId,
            project_id: projectId,
            organization_id: projectData.organization_id,
            endpoint: 'embeddings',
            model: result.model,
            provider: result.provider,
            input_tokens: result.usage.prompt_tokens,
            output_tokens: 0,
            total_tokens: result.usage.total_tokens,
            latency_ms: latencyMs,
            status: 'success',
            created_at: new Date().toISOString(),
        });

        return NextResponse.json({
            object: 'list',
            data: result.data.map((item, idx) => ({
                object: 'embedding',
                embedding: item.embedding,
                index: idx,
            })),
            model: result.model,
            usage: result.usage,
        });

    } catch (error) {
        console.error('Embeddings API error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}

// GET endpoint to list supported models
export async function GET() {
    return NextResponse.json({
        models: Object.entries(EMBEDDING_MODELS).map(([id, config]) => ({
            id,
            provider: config.provider,
            dimensions: config.dimensions,
            description: config.description,
        })),
    });
}
