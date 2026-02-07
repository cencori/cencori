/**
 * Memory Namespaces API Route
 * 
 * POST /api/memory/namespaces - Create a namespace
 * GET /api/memory/namespaces - List namespaces
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

interface CreateNamespaceRequest {
    name: string;
    description?: string;
    embeddingModel?: string;
    dimensions?: number;
    metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
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
        const body: CreateNamespaceRequest = await req.json();
        const {
            name,
            description,
            embeddingModel = 'text-embedding-3-small',
            dimensions = 1536,
            metadata = {}
        } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Name is required' },
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

        // Check if namespace already exists
        const { data: existing } = await supabase
            .from('memory_namespaces')
            .select('id')
            .eq('project_id', projectId)
            .eq('name', name)
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'conflict', message: 'Namespace with this name already exists' },
                { status: 409 }
            );
        }

        // Create namespace
        const { data: namespace, error: createError } = await supabase
            .from('memory_namespaces')
            .insert({
                project_id: projectId,
                name,
                description,
                embedding_model: embeddingModel,
                dimensions,
                metadata,
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating namespace:', createError);
            return NextResponse.json(
                { error: 'internal_error', message: 'Failed to create namespace' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            id: namespace.id,
            name: namespace.name,
            description: namespace.description,
            embeddingModel: namespace.embedding_model,
            dimensions: namespace.dimensions,
            metadata: namespace.metadata,
            createdAt: namespace.created_at,
        }, { status: 201 });

    } catch (error) {
        console.error('Namespace API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        // Get API key from header
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'unauthorized', message: 'Missing API key' },
                { status: 401 }
            );
        }

        // Initialize Supabase client
        const supabase = createAdminClient();

        // Validate API key and get project
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select('id, project_id, key_type, is_active')
            .eq('key_hash', crypto.createHash('sha256').update(apiKey).digest('hex'))
            .single();

        if (keyError || !keyData || !keyData.is_active) {
            return NextResponse.json(
                { error: 'unauthorized', message: 'Invalid or inactive API key' },
                { status: 401 }
            );
        }

        const projectId = keyData.project_id;

        // Get namespaces with memory count
        const { data: namespaces, error: listError } = await supabase
            .from('memory_namespaces')
            .select(`
                id,
                name,
                description,
                embedding_model,
                dimensions,
                metadata,
                created_at,
                memories(count)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (listError) {
            console.error('Error listing namespaces:', listError);
            return NextResponse.json(
                { error: 'internal_error', message: 'Failed to list namespaces' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            namespaces: namespaces.map(ns => ({
                id: ns.id,
                name: ns.name,
                description: ns.description,
                embeddingModel: ns.embedding_model,
                dimensions: ns.dimensions,
                metadata: ns.metadata,
                memoryCount: (ns.memories as unknown as { count: number }[])?.[0]?.count ?? 0,
                createdAt: ns.created_at,
            })),
        });

    } catch (error) {
        console.error('Namespace API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}
