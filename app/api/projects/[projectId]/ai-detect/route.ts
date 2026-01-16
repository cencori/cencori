import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey } from '@/lib/encryption';

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

// Provider API endpoints
const PROVIDER_ENDPOINTS: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    mistral: 'https://api.mistral.ai/v1/chat/completions',
    together: 'https://api.together.xyz/v1/chat/completions',
    perplexity: 'https://api.perplexity.ai/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    xai: 'https://api.x.ai/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
};

// POST - Test content against AI-detect rules
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { projectId } = await params;
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    // Verify auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { content, prompt } = body;

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        // Get project with default provider/model settings
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('organization_id, default_provider, default_model')
            .eq('id', projectId)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const defaultProvider = project.default_provider || 'openai';
        const defaultModel = project.default_model || 'gpt-4o-mini';

        // Fetch the provider key for the project's default provider first, then fall back to any available
        const { data: providerKeys } = await supabaseAdmin
            .from('provider_keys')
            .select('provider, encrypted_key, is_active')
            .eq('project_id', projectId)
            .eq('is_active', true);

        if (!providerKeys || providerKeys.length === 0) {
            return NextResponse.json({
                error: 'No AI provider configured. Add a provider key first.'
            }, { status: 400 });
        }

        // Prefer the project's default provider, otherwise use the first available
        let providerKey = providerKeys.find(pk => pk.provider === defaultProvider);
        let modelToUse = defaultModel;

        if (!providerKey) {
            // Fall back to first available provider
            providerKey = providerKeys[0];
            // Can't use the project's default model if we're using a different provider
            modelToUse = getDefaultModelForProvider(providerKey.provider);
        }

        const apiKey = decryptApiKey(providerKey.encrypted_key, project.organization_id);

        // Create the detection prompt
        const detectionPrompt = prompt || 'Analyze the following content and determine if it contains sensitive information, personal data, offensive content, or potential security risks.';


        const systemPrompt = `You are a content safety analyzer. Your task is to analyze content and report any issues found.

Respond with a JSON object containing:
{
  "is_flagged": boolean,
  "confidence": number (0-100),
  "categories": string[] (e.g., ["pii", "offensive", "security_risk", "sensitive_data"]),
  "findings": string[] (list of specific issues found),
  "severity": "low" | "medium" | "high" | "critical",
  "recommendation": "allow" | "mask" | "redact" | "block"
}

${detectionPrompt}`;

        // Call AI provider based on type
        let result;
        const provider = providerKey.provider;

        if (provider === 'anthropic') {
            result = await callAnthropic(apiKey, systemPrompt, content, modelToUse);
        } else if (provider === 'google') {
            result = await callGoogle(apiKey, systemPrompt, content, modelToUse);
        } else if (provider === 'cohere') {
            result = await callCohere(apiKey, systemPrompt, content);
        } else if (PROVIDER_ENDPOINTS[provider]) {
            // Use OpenAI-compatible endpoint
            result = await callOpenAICompatible(apiKey, systemPrompt, content, PROVIDER_ENDPOINTS[provider], modelToUse, provider);
        } else {
            // Fallback to OpenAI format with generic endpoint
            result = await callOpenAICompatible(apiKey, systemPrompt, content, 'https://api.openai.com/v1/chat/completions', modelToUse, provider);
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('[AI Detect] Error:', error);
        return NextResponse.json({ error: 'AI detection failed' }, { status: 500 });
    }
}

// Default models for providers when no project default is set
function getDefaultModelForProvider(provider: string): string {
    const defaults: Record<string, string> = {
        openai: 'gpt-4o-mini',
        anthropic: 'claude-3-haiku-20240307',
        google: 'gemini-1.5-flash',
        groq: 'llama-3.1-8b-instant',
        mistral: 'mistral-small-latest',
        together: 'meta-llama/Llama-3-8b-chat-hf',
        perplexity: 'llama-3.1-sonar-small-128k-online',
        openrouter: 'meta-llama/llama-3.1-8b-instruct',
        xai: 'grok-beta',
        deepseek: 'deepseek-chat',
        qwen: 'qwen-turbo',
        cohere: 'command-r',
    };
    return defaults[provider] || 'gpt-4o-mini';
}

async function callAnthropic(apiKey: string, systemPrompt: string, content: string, model: string) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                { role: 'user', content: `Analyze this content:\n\n${content}` },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error('Anthropic API call failed');
    }

    const data = await response.json();
    const analysisText = data.content[0].text;

    // Try to parse JSON from response
    let analysis;
    try {
        analysis = JSON.parse(analysisText);
    } catch {
        // If not valid JSON, wrap in default structure
        analysis = {
            is_flagged: false,
            confidence: 0,
            categories: [],
            findings: [analysisText],
            severity: 'low',
            recommendation: 'allow',
        };
    }

    return {
        success: true,
        analysis,
        model,
        tokens: data.usage?.input_tokens + data.usage?.output_tokens || 0,
    };
}


async function callGoogle(apiKey: string, systemPrompt: string, content: string, model: string) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\nAnalyze this content:\n\n${content}`
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Detect] Google API error:', errorText);
        throw new Error('Google AI API call failed');
    }

    const data = await response.json();
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let analysis;
    try {
        analysis = JSON.parse(analysisText);
    } catch {
        analysis = {
            is_flagged: false,
            confidence: 0,
            categories: [],
            findings: [analysisText],
            severity: 'low',
            recommendation: 'allow',
        };
    }

    return {
        success: true,
        analysis,
        model,
        tokens: data.usageMetadata?.totalTokenCount || 0,
    };
}

// Generic OpenAI-compatible API caller (works with OpenAI, Groq, Mistral, Together, Perplexity, OpenRouter, xAI, DeepSeek, Qwen)
async function callOpenAICompatible(
    apiKey: string,
    systemPrompt: string,
    content: string,
    endpoint: string,
    model: string,
    providerName: string
) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this content:\n\n${content}` },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Detect] ${providerName} API error:`, errorText);
        throw new Error(`${providerName} API call failed`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content || '{}';

    let analysis;
    try {
        analysis = JSON.parse(analysisText);
    } catch {
        analysis = {
            is_flagged: false,
            confidence: 0,
            categories: [],
            findings: [analysisText],
            severity: 'low',
            recommendation: 'allow',
        };
    }

    return {
        success: true,
        analysis,
        model,
        provider: providerName,
        tokens: data.usage?.total_tokens || 0,
    };
}

async function callCohere(apiKey: string, systemPrompt: string, content: string) {
    const response = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'command-r',
            preamble: systemPrompt,
            message: `Analyze this content:\n\n${content}`,
            temperature: 0.1,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Detect] Cohere API error:', errorText);
        throw new Error('Cohere API call failed');
    }

    const data = await response.json();
    const analysisText = data.text || '{}';

    let analysis;
    try {
        analysis = JSON.parse(analysisText);
    } catch {
        analysis = {
            is_flagged: false,
            confidence: 0,
            categories: [],
            findings: [analysisText],
            severity: 'low',
            recommendation: 'allow',
        };
    }

    return {
        success: true,
        analysis,
        model: 'command-r',
        tokens: data.meta?.billed_units?.input_tokens + data.meta?.billed_units?.output_tokens || 0,
    };
}

