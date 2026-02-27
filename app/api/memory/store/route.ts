/**
 * Memory Store API Route
 *
 * POST /api/memory/store - Store a memory with optional auto-embedding
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';
import { getPricingFromDB } from '@/lib/providers/pricing';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
} from '@/lib/gateway-middleware';

interface StoreMemoryRequest {
    namespace: string; // Namespace name or ID
    content: string;
    embedding?: number[]; // Optional pre-computed embedding
    metadata?: Record<string, unknown>;
    expiresAt?: string; // ISO date string
}

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;

    try {
        const body: StoreMemoryRequest = await req.json();
        const { namespace, content, embedding, metadata = {}, expiresAt } = body;

        if (!namespace) {
            return addGatewayHeaders(
                NextResponse.json(
                    { error: 'bad_request', message: 'Namespace is required' },
                    { status: 400 }
                ),
                { requestId: ctx.requestId }
            );
        }

        if (!content) {
            return addGatewayHeaders(
                NextResponse.json(
                    { error: 'bad_request', message: 'Content is required' },
                    { status: 400 }
                ),
                { requestId: ctx.requestId }
            );
        }

        const supabase = ctx.supabase;

        // Find namespace by name or UUID within the caller's project.
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(namespace);
        const { data: namespaceData, error: nsError } = await supabase
            .from('memory_namespaces')
            .select('id, embedding_model, dimensions')
            .eq('project_id', ctx.projectId)
            .eq(isUUID ? 'id' : 'name', namespace)
            .single();

        if (nsError || !namespaceData) {
            return addGatewayHeaders(
                NextResponse.json(
                    { error: 'not_found', message: 'Namespace not found' },
                    { status: 404 }
                ),
                { requestId: ctx.requestId }
            );
        }

        const model = namespaceData.embedding_model || 'text-embedding-3-small';
        const usingClientEmbedding = Array.isArray(embedding) && embedding.length > 0;

        let finalEmbedding = embedding;
        let promptTokens = 0;
        let totalTokens = 0;
        let providerCost = 0;
        let cencoriCharge = 0;
        let markupPercentage = 0;
        let providerName = 'none';

        if (!usingClientEmbedding) {
            providerName = 'openai';

            // Get OpenAI API key (BYOK or managed default).
            let openaiKey: string | null = null;
            const { data: providerKey } = await supabase
                .from('provider_keys')
                .select('encrypted_key, is_active')
                .eq('project_id', ctx.projectId)
                .eq('provider', 'openai')
                .eq('is_active', true)
                .single();

            if (providerKey?.encrypted_key) {
                openaiKey = decryptApiKey(providerKey.encrypted_key, ctx.organizationId);
            } else {
                openaiKey = process.env.OPENAI_API_KEY ?? null;
            }

            if (!openaiKey) {
                return addGatewayHeaders(
                    NextResponse.json(
                        {
                            error: 'provider_not_configured',
                            message: 'No OpenAI API key configured for embeddings',
                        },
                        { status: 400 }
                    ),
                    { requestId: ctx.requestId }
                );
            }

            const client = new OpenAI({ apiKey: openaiKey });
            const embeddingResponse = await client.embeddings.create({
                model,
                input: content,
            });

            finalEmbedding = embeddingResponse.data[0].embedding;
            promptTokens = embeddingResponse.usage?.prompt_tokens ?? 0;
            totalTokens = embeddingResponse.usage?.total_tokens ?? promptTokens;

            const pricing = await getPricingFromDB('openai', model);
            providerCost = (totalTokens / 1000) * pricing.inputPer1KTokens;
            cencoriCharge = providerCost * (1 + pricing.cencoriMarkupPercentage / 100);
            markupPercentage = pricing.cencoriMarkupPercentage;
        }

        const { data: memory, error: storeError } = await supabase
            .from('memories')
            .insert({
                namespace_id: namespaceData.id,
                content,
                embedding: JSON.stringify(finalEmbedding),
                metadata,
                expires_at: expiresAt || null,
            })
            .select('id, content, metadata, created_at')
            .single();

        if (storeError) {
            console.error('Error storing memory:', storeError);
            await logGatewayRequest(ctx, {
                endpoint: 'memory/store',
                model,
                provider: providerName,
                status: 'error',
                errorMessage: 'Failed to store memory',
            });

            return addGatewayHeaders(
                NextResponse.json(
                    { error: 'internal_error', message: 'Failed to store memory' },
                    { status: 500 }
                ),
                { requestId: ctx.requestId }
            );
        }

        await logGatewayRequest(ctx, {
            endpoint: 'memory/store',
            model,
            provider: providerName,
            status: 'success',
            promptTokens,
            totalTokens,
            costUsd: cencoriCharge,
            providerCostUsd: providerCost,
            cencoriChargeUsd: cencoriCharge,
            markupPercentage,
            metadata: {
                namespace_id: namespaceData.id,
                embedded: !usingClientEmbedding,
                content_length: content.length,
            },
        });
        await incrementUsage(ctx);

        return addGatewayHeaders(
            NextResponse.json(
                {
                    id: memory.id,
                    namespace,
                    content: memory.content,
                    metadata: memory.metadata,
                    embedded: !usingClientEmbedding,
                    createdAt: memory.created_at,
                },
                { status: 201 }
            ),
            { requestId: ctx.requestId }
        );
    } catch (error) {
        console.error('Memory store API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGatewayRequest(ctx, {
            endpoint: 'memory/store',
            model: 'unknown',
            provider: 'unknown',
            status: 'error',
            errorMessage,
        });

        return addGatewayHeaders(
            NextResponse.json(
                { error: 'internal_error', message: errorMessage },
                { status: 500 }
            ),
            { requestId: ctx.requestId }
        );
    }
}
