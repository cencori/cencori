import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

/**
 * GET /api/v1/models
 * 
 * Lists available models for the authenticated API key.
 * This endpoint is used by the CLI to validate API keys.
 * 
 * Headers:
 *   Authorization: Bearer <api_key>
 * 
 * Returns:
 *   200: { object: "list", data: [...models] }
 *   401: { error: "..." }
 */

interface Model {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
}

// Available models through the Cencori gateway (from ai-detect/route.ts defaults)
const AVAILABLE_MODELS: Model[] = [
    // OpenAI
    { id: 'gpt-4o', object: 'model', created: 1715367049, owned_by: 'openai' },
    { id: 'gpt-4o-mini', object: 'model', created: 1715367049, owned_by: 'openai' },
    { id: 'gpt-4-turbo', object: 'model', created: 1715367049, owned_by: 'openai' },
    { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' },
    // Anthropic
    { id: 'claude-3-5-sonnet-latest', object: 'model', created: 1715367049, owned_by: 'anthropic' },
    { id: 'claude-3-5-haiku-latest', object: 'model', created: 1715367049, owned_by: 'anthropic' },
    { id: 'claude-3-haiku-20240307', object: 'model', created: 1715367049, owned_by: 'anthropic' },
    { id: 'claude-3-opus-latest', object: 'model', created: 1715367049, owned_by: 'anthropic' },
    // Google
    { id: 'gemini-2.0-flash', object: 'model', created: 1715367049, owned_by: 'google' },
    { id: 'gemini-1.5-pro', object: 'model', created: 1715367049, owned_by: 'google' },
    { id: 'gemini-1.5-flash', object: 'model', created: 1715367049, owned_by: 'google' },
    // Groq
    { id: 'llama-3.1-8b-instant', object: 'model', created: 1715367049, owned_by: 'groq' },
    { id: 'llama-3.1-70b-versatile', object: 'model', created: 1715367049, owned_by: 'groq' },
    // Mistral
    { id: 'mistral-large-latest', object: 'model', created: 1715367049, owned_by: 'mistral' },
    { id: 'mistral-small-latest', object: 'model', created: 1715367049, owned_by: 'mistral' },
    // Together AI
    { id: 'meta-llama/Llama-3-8b-chat-hf', object: 'model', created: 1715367049, owned_by: 'together' },
    { id: 'meta-llama/Llama-3-70b-chat-hf', object: 'model', created: 1715367049, owned_by: 'together' },
    // Perplexity
    { id: 'llama-3.1-sonar-small-128k-online', object: 'model', created: 1715367049, owned_by: 'perplexity' },
    { id: 'llama-3.1-sonar-large-128k-online', object: 'model', created: 1715367049, owned_by: 'perplexity' },
    // OpenRouter
    { id: 'meta-llama/llama-3.1-8b-instruct', object: 'model', created: 1715367049, owned_by: 'openrouter' },
    // xAI
    { id: 'grok-beta', object: 'model', created: 1715367049, owned_by: 'xai' },
    { id: 'grok-2', object: 'model', created: 1715367049, owned_by: 'xai' },
    // DeepSeek
    { id: 'deepseek-chat', object: 'model', created: 1715367049, owned_by: 'deepseek' },
    { id: 'deepseek-reasoner', object: 'model', created: 1715367049, owned_by: 'deepseek' },
    // Qwen (Alibaba)
    { id: 'qwen-turbo', object: 'model', created: 1715367049, owned_by: 'qwen' },
    { id: 'qwen-plus', object: 'model', created: 1715367049, owned_by: 'qwen' },
    // Cohere
    { id: 'command-r', object: 'model', created: 1715367049, owned_by: 'cohere' },
    { id: 'command-r-plus', object: 'model', created: 1715367049, owned_by: 'cohere' },
];

export async function GET(req: NextRequest) {
    const supabase = createAdminClient();

    // Extract API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
            {
                error: {
                    message: 'Missing API key. Use Authorization: Bearer <api_key>',
                    type: 'invalid_request_error',
                    code: 'missing_api_key'
                }
            },
            { status: 401 }
        );
    }

    const apiKey = authHeader.replace('Bearer ', '').trim();
    if (!apiKey) {
        return NextResponse.json(
            {
                error: {
                    message: 'Invalid API key format',
                    type: 'invalid_request_error',
                    code: 'invalid_api_key'
                }
            },
            { status: 401 }
        );
    }

    // Hash the key and look it up
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('id, project_id, name, projects!inner(id, name)')
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .single();

    if (keyError || !keyData) {
        return NextResponse.json(
            {
                error: {
                    message: 'Invalid API key',
                    type: 'invalid_request_error',
                    code: 'invalid_api_key'
                }
            },
            { status: 401 }
        );
    }

    // API key is valid - return available models (OpenAI-compatible format)
    return NextResponse.json({
        object: 'list',
        data: AVAILABLE_MODELS,
    });
}
