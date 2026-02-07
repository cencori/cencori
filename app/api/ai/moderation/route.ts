import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import { decryptApiKey } from '@/lib/encryption';

interface ModerationRequest {
    input: string | string[];
    model?: 'text-moderation-latest' | 'text-moderation-stable' | 'omni-moderation-latest';
}

interface ModerationResult {
    flagged: boolean;
    categories: {
        hate: boolean;
        'hate/threatening': boolean;
        harassment: boolean;
        'harassment/threatening': boolean;
        'self-harm': boolean;
        'self-harm/intent': boolean;
        'self-harm/instructions': boolean;
        sexual: boolean;
        'sexual/minors': boolean;
        violence: boolean;
        'violence/graphic': boolean;
    };
    category_scores: {
        hate: number;
        'hate/threatening': number;
        harassment: number;
        'harassment/threatening': number;
        'self-harm': number;
        'self-harm/intent': number;
        'self-harm/instructions': number;
        sexual: number;
        'sexual/minors': number;
        violence: number;
        'violence/graphic': number;
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
        const body: ModerationRequest = await req.json();
        const { input, model = 'text-moderation-latest' } = body;

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
                { error: 'provider_not_configured', message: 'No OpenAI API key configured' },
                { status: 400 }
            );
        }

        const client = new OpenAI({ apiKey: openaiKey });

        // Run moderation
        const response = await client.moderations.create({
            input,
            model,
        });

        const latencyMs = Date.now() - startTime;

        // Check if any content was flagged
        const anyFlagged = response.results.some(r => r.flagged);

        // Log the request
        const inputText = Array.isArray(input) ? input.join(' ') : input;
        await supabase.from('ai_requests').insert({
            id: requestId,
            project_id: projectId,
            organization_id: projectData.organization_id,
            endpoint: 'moderation',
            model,
            provider: 'openai',
            input_tokens: Math.ceil(inputText.length / 4),
            output_tokens: 0,
            total_tokens: Math.ceil(inputText.length / 4),
            latency_ms: latencyMs,
            status: anyFlagged ? 'flagged' : 'success',
            metadata: {
                flagged: anyFlagged,
                results_count: response.results.length,
            },
            created_at: new Date().toISOString(),
        });

        // If flagged, also log a security incident
        if (anyFlagged) {
            const flaggedCategories = response.results
                .filter(r => r.flagged)
                .flatMap(r => Object.entries(r.categories)
                    .filter(([_, flagged]) => flagged)
                    .map(([category]) => category)
                );

            await supabase.from('security_incidents').insert({
                id: crypto.randomUUID(),
                project_id: projectId,
                organization_id: projectData.organization_id,
                incident_type: 'content_moderation',
                severity: 'medium',
                description: `Content flagged for: ${flaggedCategories.join(', ')}`,
                metadata: {
                    categories: flaggedCategories,
                    request_id: requestId,
                },
                created_at: new Date().toISOString(),
            });
        }

        return NextResponse.json({
            id: response.id,
            model: response.model,
            results: response.results.map(result => ({
                flagged: result.flagged,
                categories: result.categories,
                category_scores: result.category_scores,
            })),
        });

    } catch (error) {
        console.error('Moderation API error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: 'internal_error', message: errorMessage },
            { status: 500 }
        );
    }
}

// GET endpoint to list available models
export async function GET() {
    return NextResponse.json({
        models: [
            { id: 'text-moderation-latest', description: 'Latest moderation model' },
            { id: 'text-moderation-stable', description: 'Stable moderation model' },
            { id: 'omni-moderation-latest', description: 'Multimodal moderation (text + images)' },
        ],
        categories: [
            'hate',
            'hate/threatening',
            'harassment',
            'harassment/threatening',
            'self-harm',
            'self-harm/intent',
            'self-harm/instructions',
            'sexual',
            'sexual/minors',
            'violence',
            'violence/graphic',
        ],
    });
}
