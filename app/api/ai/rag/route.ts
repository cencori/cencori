import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import OpenAI from 'openai';
import {
    GeminiProvider,
    OpenAIProvider,
    AnthropicProvider,
    OpenAICompatibleProvider,
    CohereProvider,
    isOpenAICompatible,
} from '@/lib/providers';
import { ProviderRouter } from '@/lib/providers/router';
import { UnifiedMessage } from '@/lib/providers/base';
import { decryptApiKey } from '@/lib/encryption';

const router = new ProviderRouter();

interface Memory {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
}

// Initialize providers
function initializeDefaultProviders() {
    if (!router.hasProvider('google') && process.env.GEMINI_API_KEY) {
        try {
            router.registerProvider('google', new GeminiProvider());
        } catch (error) {
            console.warn('[RAG] Gemini provider not available:', error);
        }
    }

    if (!router.hasProvider('openai') && process.env.OPENAI_API_KEY) {
        try {
            router.registerProvider('openai', new OpenAIProvider());
        } catch (error) {
            console.warn('[RAG] OpenAI provider not available:', error);
        }
    }

    if (!router.hasProvider('anthropic') && process.env.ANTHROPIC_API_KEY) {
        try {
            router.registerProvider('anthropic', new AnthropicProvider());
        } catch (error) {
            console.warn('[RAG] Anthropic provider not available:', error);
        }
    }

    if (!router.hasProvider('cohere') && process.env.COHERE_API_KEY) {
        try {
            router.registerProvider('cohere', new CohereProvider(process.env.COHERE_API_KEY));
        } catch (error) {
            console.warn('[RAG] Cohere provider not available:', error);
        }
    }

    const openAICompatibleEnvVars: Record<string, string> = {
        xai: 'XAI_API_KEY',
        deepseek: 'DEEPSEEK_API_KEY',
        groq: 'GROQ_API_KEY',
        mistral: 'MISTRAL_API_KEY',
        together: 'TOGETHER_API_KEY',
        openrouter: 'OPENROUTER_API_KEY',
        perplexity: 'PERPLEXITY_API_KEY',
    };

    for (const [provider, envVar] of Object.entries(openAICompatibleEnvVars)) {
        const apiKey = process.env[envVar];
        if (!router.hasProvider(provider) && apiKey) {
            try {
                router.registerProvider(provider, new OpenAICompatibleProvider(provider, apiKey));
            } catch (error) {
                console.warn(`[RAG] ${provider} provider not available:`, error);
            }
        }
    }
}

async function initializeBYOKProviders(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    organizationId: string,
    targetProvider: string
): Promise<boolean> {
    try {
        const { data: providerKey, error } = await supabase
            .from('provider_keys')
            .select('encrypted_key, is_active')
            .eq('project_id', projectId)
            .eq('provider', targetProvider)
            .single();

        if (!error && providerKey && providerKey.is_active) {
            const apiKey = decryptApiKey(providerKey.encrypted_key, organizationId);
            if (targetProvider === 'google') {
                router.registerProvider(targetProvider, new GeminiProvider(apiKey));
                return true;
            } else if (targetProvider === 'openai') {
                router.registerProvider(targetProvider, new OpenAIProvider(apiKey));
                return true;
            } else if (targetProvider === 'anthropic') {
                router.registerProvider(targetProvider, new AnthropicProvider(apiKey));
                return true;
            } else if (isOpenAICompatible(targetProvider)) {
                router.registerProvider(targetProvider, new OpenAICompatibleProvider(targetProvider, apiKey));
                return true;
            } else if (targetProvider === 'cohere') {
                router.registerProvider(targetProvider, new CohereProvider(apiKey));
                return true;
            }
        }

        return router.hasProvider(targetProvider);
    } catch (error) {
        console.error(`[RAG] Failed to initialize BYOK provider ${targetProvider}:`, error);
        return router.hasProvider(targetProvider);
    }
}

// Search memories semantically
async function searchMemories(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    namespace: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.5
): Promise<Memory[]> {
    // Get namespace
    const { data: namespaceData } = await supabase
        .from('memory_namespaces')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', namespace)
        .single();

    if (!namespaceData) {
        console.log(`[RAG] Namespace "${namespace}" not found for project ${projectId}`);
        return [];
    }

    // Generate embedding for query
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search with vector similarity
    const { data: memories, error } = await supabase.rpc('search_memories', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        p_namespace_id: namespaceData.id,
    });

    if (error) {
        console.error('[RAG] Memory search error:', error);
        return [];
    }

    return (memories || []).map((m: { id: string; content: string; metadata: Record<string, unknown>; similarity: number }) => ({
        id: m.id,
        content: m.content,
        metadata: m.metadata,
        similarity: m.similarity,
    }));
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const supabase = createAdminClient();

    try {
        // Auth - same as chat API
        const apiKey = req.headers.get('CENCORI_API_KEY') || req.headers.get('Authorization')?.replace('Bearer ', '');

        if (!apiKey) {
            return NextResponse.json({ error: 'Missing CENCORI_API_KEY header' }, { status: 401 });
        }

        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select(`
                id,
                project_id,
                projects!inner(
                    id,
                    organization_id,
                    default_model,
                    default_provider,
                    organizations!inner(id, subscription_tier)
                )
            `)
            .eq('key_hash', keyHash)
            .is('revoked_at', null)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const project = keyData.projects as unknown as {
            id: string;
            organization_id: string;
            default_model: string | null;
            default_provider: string | null;
            organizations: { id: string; subscription_tier: string };
        };

        const body = await req.json();
        const {
            messages,
            model,
            namespace,
            temperature,
            maxTokens,
            max_tokens,
            stream = false,
            limit = 5,
            threshold = 0.5,
            include_sources = true,
        } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
        }

        if (!namespace) {
            return NextResponse.json({ error: 'namespace is required' }, { status: 400 });
        }

        // Use project's configured default model, falling back to gemini-2.0-flash
        const resolvedModel = model || project.default_model || 'gemini-2.0-flash';

        // Get last user message for retrieval
        const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
        if (!lastUserMessage) {
            return NextResponse.json({ error: 'No user message found' }, { status: 400 });
        }

        // Search for relevant memories
        const memories = await searchMemories(
            supabase,
            project.id,
            namespace,
            lastUserMessage.content,
            limit,
            threshold
        );

        console.log(`[RAG] Found ${memories.length} relevant memories for query`);

        // Build context from memories
        let contextBlock = '';
        if (memories.length > 0) {
            contextBlock = `\n\n## Relevant Context\nThe following information was retrieved from memory and may be relevant:\n\n`;
            memories.forEach((mem, i) => {
                contextBlock += `[${i + 1}] ${mem.content}\n`;
            });
            contextBlock += '\nUse the above context to inform your response when relevant.\n';
        }

        // Build augmented messages
        const unifiedMessages: UnifiedMessage[] = messages.map((msg: { role: string; content: string }) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
        }));

        // Inject context into system message or add as first message
        const systemIndex = unifiedMessages.findIndex(m => m.role === 'system');
        if (systemIndex !== -1) {
            unifiedMessages[systemIndex].content += contextBlock;
        } else if (memories.length > 0) {
            unifiedMessages.unshift({
                role: 'system',
                content: `You are a helpful assistant.${contextBlock}`,
            });
        }

        // Initialize provider
        const providerName = router.detectProvider(resolvedModel);
        const normalizedModel = router.normalizeModelName(resolvedModel);

        const byokInitialized = await initializeBYOKProviders(
            supabase,
            project.id,
            project.organization_id,
            providerName
        );

        if (!byokInitialized) {
            initializeDefaultProviders();
        }

        if (!router.hasProvider(providerName)) {
            return NextResponse.json(
                {
                    error: `Provider '${providerName}' is not configured`,
                    message: `Please add your ${providerName} API key in project settings.`,
                },
                { status: 400 }
            );
        }

        const provider = router.getProviderForModel(resolvedModel);

        const chatRequest = {
            messages: unifiedMessages,
            model: normalizedModel,
            temperature,
            maxTokens: maxTokens || max_tokens,
        };

        if (stream === true) {
            // Streaming response
            const encoder = new TextEncoder();

            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        let fullContent = '';
                        const streamGen = provider.stream(chatRequest);

                        // Send sources first if requested
                        if (include_sources && memories.length > 0) {
                            const sourcesChunk = {
                                type: 'sources',
                                sources: memories.map(m => ({
                                    content: m.content,
                                    metadata: m.metadata,
                                    similarity: m.similarity,
                                })),
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(sourcesChunk)}\n\n`));
                        }

                        for await (const chunk of streamGen) {
                            fullContent += chunk.delta;
                            const chunkData = {
                                type: 'content',
                                delta: chunk.delta,
                                finish_reason: chunk.finishReason,
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
                        }

                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();

                        // Log request
                        const latencyMs = Date.now() - startTime;
                        await supabase.from('ai_requests').insert({
                            project_id: project.id,
                            api_key_id: keyData.id,
                            input_tokens: fullContent.length / 4,
                            output_tokens: fullContent.length / 4,
                            model: normalizedModel,
                            latency_ms: latencyMs,
                            status: 'success',
                            endpoint: '/ai/rag',
                        });
                    } catch (error) {
                        console.error('[RAG] Stream error:', error);
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
                        );
                        controller.close();
                    }
                },
            });

            return new Response(readableStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                },
            });
        } else {
            // Non-streaming response
            const response = await provider.chat(chatRequest);
            const latencyMs = Date.now() - startTime;

            // Log request
            await supabase.from('ai_requests').insert({
                project_id: project.id,
                api_key_id: keyData.id,
                input_tokens: response.usage?.promptTokens || 0,
                output_tokens: response.usage?.completionTokens || 0,
                model: normalizedModel,
                latency_ms: latencyMs,
                status: 'success',
                endpoint: '/ai/rag',
            });

            const result: {
                message: { role: string; content: string };
                model: string;
                provider: string;
                usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
                latency_ms: number;
                sources?: { content: string; metadata: Record<string, unknown>; similarity: number }[];
            } = {
                message: {
                    role: 'assistant',
                    content: response.content,
                },
                model: normalizedModel,
                provider: providerName,
                usage: {
                    prompt_tokens: response.usage?.promptTokens || 0,
                    completion_tokens: response.usage?.completionTokens || 0,
                    total_tokens: response.usage?.totalTokens || 0,
                },
                latency_ms: latencyMs,
            };

            if (include_sources) {
                result.sources = memories.map(m => ({
                    content: m.content,
                    metadata: m.metadata,
                    similarity: m.similarity,
                }));
            }

            return NextResponse.json(result);
        }
    } catch (error) {
        console.error('[RAG] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
