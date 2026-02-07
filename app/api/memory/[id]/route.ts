/**
 * Memory Item API Route
 * 
 * GET /api/memory/[id] - Get a memory by ID
 * DELETE /api/memory/[id] - Delete a memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

        // Get memory with namespace check
        const { data: memory, error: memoryError } = await supabase
            .from('memories')
            .select(`
                id,
                content,
                metadata,
                expires_at,
                created_at,
                updated_at,
                memory_namespaces!inner(id, name, project_id)
            `)
            .eq('id', id)
            .single();

        if (memoryError || !memory) {
            return NextResponse.json(
                { error: 'not_found', message: 'Memory not found' },
                { status: 404 }
            );
        }

        // Verify project ownership
        const memoryNamespace = memory.memory_namespaces as unknown as { id: string; name: string; project_id: string };
        if (memoryNamespace.project_id !== projectId) {
            return NextResponse.json(
                { error: 'forbidden', message: 'Access denied' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            id: memory.id,
            namespace: memoryNamespace.name,
            content: memory.content,
            metadata: memory.metadata,
            expiresAt: memory.expires_at,
            createdAt: memory.created_at,
            updatedAt: memory.updated_at,
        });

    } catch (error) {
        console.error('Memory GET API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

        // First verify ownership
        const { data: memory, error: memoryError } = await supabase
            .from('memories')
            .select(`
                id,
                memory_namespaces!inner(project_id)
            `)
            .eq('id', id)
            .single();

        if (memoryError || !memory) {
            return NextResponse.json(
                { error: 'not_found', message: 'Memory not found' },
                { status: 404 }
            );
        }

        const memoryNamespace = memory.memory_namespaces as unknown as { project_id: string };
        if (memoryNamespace.project_id !== projectId) {
            return NextResponse.json(
                { error: 'forbidden', message: 'Access denied' },
                { status: 403 }
            );
        }

        // Delete the memory
        const { error: deleteError } = await supabase
            .from('memories')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return NextResponse.json(
                { error: 'internal_error', message: 'Failed to delete memory' },
                { status: 500 }
            );
        }

        return NextResponse.json({ deleted: true, id });

    } catch (error) {
        console.error('Memory DELETE API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}
