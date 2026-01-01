/**
 * Debug endpoint to validate an API key and return project info
 * GET /api/debug/validate-key (with CENCORI_API_KEY header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const supabase = createAdminClient();

    try {
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json({
                valid: false,
                error: 'Missing CENCORI_API_KEY header'
            }, { status: 401 });
        }

        // Hash the key
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const keyPrefix = apiKey.substring(0, 12) + '...';

        // Look up the key
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
                id,
                name,
                key_prefix,
                project_id,
                environment,
                key_type,
                revoked_at,
                created_at,
                projects!inner(
                    id,
                    name,
                    slug
                )
            `)
            .eq('key_hash', keyHash)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json({
                valid: false,
                error: 'API key not found in database',
                keyPrefix,
                keyHashStart: keyHash.substring(0, 12) + '...',
                dbError: keyError?.message
            }, { status: 404 });
        }

        if (keyData.revoked_at) {
            return NextResponse.json({
                valid: false,
                error: 'API key has been revoked',
                keyPrefix,
                revokedAt: keyData.revoked_at
            }, { status: 403 });
        }

        // Get recent request count for this key
        const { count } = await supabase
            .from('ai_requests')
            .select('*', { count: 'exact', head: true })
            .eq('api_key_id', keyData.id);

        return NextResponse.json({
            valid: true,
            keyInfo: {
                id: keyData.id,
                name: keyData.name,
                keyPrefix: keyData.key_prefix,
                environment: keyData.environment,
                keyType: keyData.key_type,
                createdAt: keyData.created_at
            },
            project: keyData.projects,
            requestCount: count || 0
        });

    } catch (error) {
        console.error('[Debug] Error validating key:', error);
        return NextResponse.json({
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
