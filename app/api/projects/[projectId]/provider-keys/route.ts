import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/encryption';
import { SUPPORTED_PROVIDERS, getProvider } from '@/lib/providers/config';

interface ProviderKeyResponse {
    provider: string;
    providerName: string;
    hasKey: boolean;
    keyHint?: string;
    isActive: boolean;
    defaultModel?: string;
    createdAt?: string;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { projectId } = await params;

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, default_provider, default_model')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { data: providerKeys, error } = await supabase
            .from('provider_keys')
            .select('provider, key_hint, is_active, created_at')
            .eq('project_id', projectId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const keyMap = new Map(providerKeys?.map(k => [k.provider, k]) || []);

        const providers: ProviderKeyResponse[] = SUPPORTED_PROVIDERS.map(p => {
            const key = keyMap.get(p.id);
            return {
                provider: p.id,
                providerName: p.name,
                hasKey: !!key,
                keyHint: key?.key_hint || undefined,
                isActive: key?.is_active ?? false,
                createdAt: key?.created_at || undefined,
            };
        });

        return NextResponse.json({
            providers,
            defaults: {
                provider: project.default_provider,
                model: project.default_model,
            },
        });
    } catch (error) {
        console.error('[API] Error fetching provider keys:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { projectId } = await params;

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, organization_id')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const body = await req.json();
        const { provider, apiKey, setAsDefault, defaultModel } = body;

        const providerConfig = getProvider(provider);
        if (!providerConfig) {
            return NextResponse.json(
                { error: `Invalid provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.map(p => p.id).join(', ')}` },
                { status: 400 }
            );
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'API key is required' }, { status: 400 });
        }

        const encryptedKey = encryptApiKey(apiKey, project.organization_id);

        const keyHint = apiKey.length > 4 ? `...${apiKey.slice(-4)}` : '****';

        const { data: providerKey, error } = await supabase
            .from('provider_keys')
            .upsert({
                project_id: projectId,
                provider,
                encrypted_key: encryptedKey,
                key_hint: keyHint,
                is_active: true,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'project_id,provider',
            })
            .select()
            .single();

        if (error) {
            console.error('[API] Error saving provider key:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (setAsDefault || defaultModel) {
            const projectUpdate: Record<string, string> = {};
            if (setAsDefault) projectUpdate.default_provider = provider;
            if (defaultModel) projectUpdate.default_model = defaultModel;

            await supabase
                .from('projects')
                .update(projectUpdate)
                .eq('id', projectId);
        }

        return NextResponse.json({
            success: true,
            provider: {
                provider: providerKey.provider,
                keyHint: providerKey.key_hint,
                isActive: providerKey.is_active,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('[API] Error saving provider key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
