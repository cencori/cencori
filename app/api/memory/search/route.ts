/**
 * Memory Search API Route
 * 
 * POST /api/memory/search - Semantic search across memories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';

interface SearchMemoryRequest {
    namespace: string;  // Namespace name or ID
    query: string;
    limit?: number;
    threshold?: number;  // Similarity threshold (0-1)
    filter?: Record<string, unknown>;  // Metadata filter
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();

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
        const body: SearchMemoryRequest = await req.json();
        const { namespace, query, limit = 10, threshold = 0.7, filter } = body;

        if (!namespace) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Namespace is required' },
                { status: 400 }
            );
        }

        if (!query) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Query is required' },
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
            .select('id, embedding_model')
            .eq('project_id', projectId)
            .eq(isUUID ? 'id' : 'name', namespace)
            .single();

        if (nsError || !namespaceData) {
            return NextResponse.json(
                { error: 'not_found', message: 'Namespace not found' },
                { status: 404 }
            );
        }

        // Get OpenAI API key for embedding the query
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

        // Generate query embedding
        const embeddingResponse = await client.embeddings.create({
            model: namespaceData.embedding_model || 'text-embedding-3-small',
            input: query,
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Search using the database function
        const { data: results, error: searchError } = await supabase.rpc('search_memories', {
            p_namespace_id: namespaceData.id,
            p_query_embedding: JSON.stringify(queryEmbedding),
            p_limit: limit,
            p_threshold: threshold,
        });

        if (searchError) {
            console.error('Search error:', searchError);
            return NextResponse.json(
                { error: 'internal_error', message: 'Search failed' },
                { status: 500 }
            );
        }

        // Apply metadata filter if provided
        let filteredResults = results || [];
        if (filter && Object.keys(filter).length > 0) {
            filteredResults = filteredResults.filter((r: { metadata: Record<string, unknown> }) => {
                return Object.entries(filter).every(([key, value]) => r.metadata?.[key] === value);
            });
        }

        const latencyMs = Date.now() - startTime;

        // Log the search request
        await supabase.from('ai_requests').insert({
            id: crypto.randomUUID(),
            project_id: projectId,
            organization_id: projectData.organization_id,
            endpoint: 'memory/search',
            model: namespaceData.embedding_model || 'text-embedding-3-small',
            provider: 'openai',
            input_tokens: embeddingResponse.usage?.prompt_tokens ?? 0,
            output_tokens: 0,
            total_tokens: embeddingResponse.usage?.total_tokens ?? 0,
            latency_ms: latencyMs,
            status: 'success',
            metadata: {
                results_count: filteredResults.length,
                namespace: namespace,
            },
            created_at: new Date().toISOString(),
        });

        return NextResponse.json({
            results: filteredResults.map((r: { id: string; content: string; metadata: Record<string, unknown>; similarity: number; created_at: string }) => ({
                id: r.id,
                content: r.content,
                metadata: r.metadata,
                similarity: r.similarity,
                createdAt: r.created_at,
            })),
            query,
            namespace,
            count: filteredResults.length,
            latencyMs,
        });

    } catch (error) {
        console.error('Memory search API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}
