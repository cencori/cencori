import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

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

        // Fetch project's provider keys to use for AI detection
        const { data: providerKeys } = await supabaseAdmin
            .from('provider_keys')
            .select('provider, api_key')
            .eq('project_id', projectId)
            .limit(1);

        if (!providerKeys || providerKeys.length === 0) {
            return NextResponse.json({
                error: 'No AI provider configured. Add a provider key first.'
            }, { status: 400 });
        }

        const provider = providerKeys[0];

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

        // Call AI provider
        let result;
        if (provider.provider === 'openai') {
            result = await callOpenAI(provider.api_key, systemPrompt, content);
        } else if (provider.provider === 'anthropic') {
            result = await callAnthropic(provider.api_key, systemPrompt, content);
        } else {
            // Default to OpenAI-compatible endpoint
            result = await callOpenAI(provider.api_key, systemPrompt, content);
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('[AI Detect] Error:', error);
        return NextResponse.json({ error: 'AI detection failed' }, { status: 500 });
    }
}

async function callOpenAI(apiKey: string, systemPrompt: string, content: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this content:\n\n${content}` },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        throw new Error('OpenAI API call failed');
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);

    return {
        success: true,
        analysis,
        model: 'gpt-4o-mini',
        tokens: data.usage?.total_tokens || 0,
    };
}

async function callAnthropic(apiKey: string, systemPrompt: string, content: string) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
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
        model: 'claude-3-haiku',
        tokens: data.usage?.input_tokens + data.usage?.output_tokens || 0,
    };
}
