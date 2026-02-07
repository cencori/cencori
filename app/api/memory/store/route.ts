/**
 * Memory Store API Route
 * 
 * POST /api/memory/store - Store a memory with auto-embedding
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';

interface StoreMemoryRequest {
    namespace: string;  // Namespace name or ID
    content: string;
    embedding?: number[];  // Optional pre-computed embedding
    metadata?: Record<string, unknown>;
    expiresAt?: string;  // ISO date string
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
        const body: StoreMemoryRequest = await req.json();
        const { namespace, content, embedding, metadata = {}, expiresAt } = body;

        if (!namespace) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Namespace is required' },
                { status: 400 }
            );
        }

        if (!content) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Content is required' },
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

        // Find namespace by name or ID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(namespace);

        const { data: namespaceData, error: nsError } = await supabase
            .from('memory_namespaces')
            .select('id, embedding_model, dimensions')
            .eq('project_id', projectId)
            .eq(isUUID ? 'id' : 'name', namespace)
            .single();

        if (nsError || !namespaceData) {
            return NextResponse.json(
                { error: 'not_found', message: 'Namespace not found' },
                { status: 404 }
            );
        }

        // Generate embedding if not provided
        let finalEmbedding = embedding;

        if (!finalEmbedding) {
            // Get OpenAI API key (BYOK or default)
            let openaiKey: string | null = null;

            const { data: providerKey } = await supabase
                .from('provider_keys')
                .select('encrypted_key, is_active')
                .eq('project_id', projectId)
                .eq('provider', 'openai')
                .eq('is_active', true)
                .single();

            if (providerKey?.encrypted_key) {
                openaiKey = decryptApiKey(providerKey.encrypted_key, projectData.organization_id);
            } else {
                openaiKey = process.env.OPENAI_API_KEY ?? null;
            }

            if (!openaiKey) {
                return NextResponse.json(
                    { error: 'provider_not_configured', message: 'No OpenAI API key configured for embeddings' },
                    { status: 400 }
                );
            }

            const client = new OpenAI({ apiKey: openaiKey });

            // Generate embedding
            const embeddingResponse = await client.embeddings.create({
                model: namespaceData.embedding_model || 'text-embedding-3-small',
                input: content,
            });

            finalEmbedding = embeddingResponse.data[0].embedding;

            // Log embedding request
            await supabase.from('ai_requests').insert({
                id: crypto.randomUUID(),
                project_id: projectId,
                organization_id: projectData.organization_id,
                endpoint: 'memory/store',
                model: namespaceData.embedding_model || 'text-embedding-3-small',
                provider: 'openai',
                input_tokens: embeddingResponse.usage?.prompt_tokens ?? 0,
                output_tokens: 0,
                total_tokens: embeddingResponse.usage?.total_tokens ?? 0,
                latency_ms: Date.now() - startTime,
                status: 'success',
                created_at: new Date().toISOString(),
            });
        }

        // Store the memory
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
            return NextResponse.json(
                { error: 'internal_error', message: 'Failed to store memory' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            id: memory.id,
            namespace: namespace,
            content: memory.content,
            metadata: memory.metadata,
            embedded: !embedding,  // true if we generated the embedding
            createdAt: memory.created_at,
        }, { status: 201 });

    } catch (error) {
        console.error('Memory store API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}
