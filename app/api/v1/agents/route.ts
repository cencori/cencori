import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, handleCorsPreFlight, type GatewayContext } from '@/lib/gateway-middleware';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const respondError = (status: number, message: string, code = 'invalid_request_error') =>
    NextResponse.json(
        { error: { message, type: 'invalid_request_error', code }, status: 'failed' },
        { status }
    );

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    try {
        const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);
        const adminClient = createAdminClient();

        let projectId: string;
        let authenticatedUserId: string | null = null;

        if (providedApiKey) {
            const validation = await validateGatewayRequest(req);
            if (!validation.success) return validation.response;
            projectId = validation.context.projectId;
        } else {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader) return respondError(401, 'Missing API key or Authorization header', 'unauthorized');
            const userClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } },
            });
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            if (authError || !user) return respondError(401, 'Unauthorized', 'unauthorized');
            authenticatedUserId = user.id;

            const body = await req.json() as { project_id?: string };
            if (!body.project_id) return respondError(400, 'project_id is required for JWT-authenticated requests', 'missing_project_id');
            projectId = body.project_id;
        }

        const body = await req.json() as {
            name: string;
            description?: string;
            config?: {
                model?: string;
                system_prompt?: string;
                tools?: string[];
                temperature?: number;
            };
        };

        if (!body.name?.trim()) return respondError(400, 'name is required', 'missing_name');

        const { data: agent, error: agentError } = await adminClient
            .from('agents')
            .insert({
                project_id: projectId,
                name: body.name.trim(),
                description: body.description?.trim() || null,
                blueprint: 'custom',
                is_active: true,
                shadow_mode: true,
            })
            .select('id, name, description, is_active, shadow_mode, created_at')
            .single();

        if (agentError || !agent) {
            console.error('[Agents API] Failed to create agent:', agentError);
            return respondError(500, 'Failed to create agent', 'creation_failed');
        }

        const config = body.config || {};
        const { data: agentConfig, error: configError } = await adminClient
            .from('agent_configs')
            .insert({
                agent_id: agent.id,
                model: config.model || 'gpt-4o',
                system_prompt: config.system_prompt || null,
                tools: config.tools || [],
                temperature: config.temperature ?? 0.7,
            })
            .select('model, system_prompt, tools, temperature')
            .single();

        if (configError) {
            console.error('[Agents API] Failed to create agent config:', configError);
            await adminClient.from('agents').delete().eq('id', agent.id);
            return respondError(500, 'Failed to create agent configuration', 'config_creation_failed');
        }

        return NextResponse.json({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            is_active: agent.is_active,
            shadow_mode: agent.shadow_mode,
            created_at: agent.created_at,
            config: {
                model: agentConfig.model,
                system_prompt: agentConfig.system_prompt,
                tools: agentConfig.tools,
                temperature: agentConfig.temperature,
            },
        }, { status: 201 });
    } catch (error: unknown) {
        console.error('[Agents API] Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return respondError(500, message, 'internal_error');
    }
}

export async function GET(req: NextRequest) {
    try {
        const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);
        const adminClient = createAdminClient();
        let gatewayCtx: GatewayContext | null = null;

        let projectId: string | null = null;

        if (providedApiKey) {
            const validation = await validateGatewayRequest(req);
            if (!validation.success) return validation.response;
            gatewayCtx = validation.context;
            projectId = gatewayCtx.projectId;
        } else {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader) return respondError(401, 'Missing API key or Authorization header', 'unauthorized');
            const userClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } },
            });
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            if (authError || !user) return respondError(401, 'Unauthorized', 'unauthorized');

            const { searchParams } = new URL(req.url);
            projectId = searchParams.get('project_id');
            if (!projectId) return respondError(400, 'project_id query param is required for JWT-authenticated requests', 'missing_project_id');
        }

        const { data: agents, error } = await adminClient
            .from('agents')
            .select('id, name, description, is_active, shadow_mode, created_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Agents API] Failed to list agents:', error);
            return respondError(500, 'Failed to list agents', 'list_failed');
        }

        return NextResponse.json({ data: agents || [] });
    } catch (error: unknown) {
        console.error('[Agents API] Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return respondError(500, message, 'internal_error');
    }
}
