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
    defaultImageModel?: string;
    createdAt?: string;
    apiKey?: string;
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
            .select('id, organization_id, default_provider, default_model, default_image_model')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { data: providerKeys, error } = await supabase
            .from('provider_keys')
            .select('provider, encrypted_key, key_hint, is_active, created_at, default_model, default_image_model')
            .eq('project_id', projectId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const keyMap = new Map(providerKeys?.map(k => [k.provider, k]) || []);

        const providers: ProviderKeyResponse[] = SUPPORTED_PROVIDERS.map(p => {
            const key = keyMap.get(p.id);
            let decryptedKey = undefined;
            if (key?.encrypted_key && project.organization_id) {
                try {
                    const { decryptApiKey } = require('@/lib/encryption');
                    decryptedKey = decryptApiKey(key.encrypted_key, project.organization_id);
                } catch (e) {
                    console.error(`Failed to decrypt key for ${p.id}`);
                }
            }

            return {
                provider: p.id,
                providerName: p.name,
                hasKey: !!key,
                keyHint: key?.key_hint || undefined,
                apiKey: decryptedKey,
                isActive: key?.is_active ?? false,
                defaultModel: key?.default_model || undefined,
                defaultImageModel: key?.default_image_model || undefined,
                createdAt: key?.created_at || undefined,
            };
        });

        return NextResponse.json({
            providers,
            defaults: {
                provider: project.default_provider,
                model: project.default_model,
                imageModel: project.default_image_model,
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
        const { provider, apiKey, setAsDefault, defaultModel, defaultImageModel } = body;

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
                default_model: defaultModel || undefined,
                default_image_model: defaultImageModel || undefined,
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

        if (setAsDefault || defaultModel || defaultImageModel) {
            const projectUpdate: Record<string, string> = {};
            if (setAsDefault) projectUpdate.default_provider = provider;
            if (defaultModel) projectUpdate.default_model = defaultModel;
            if (defaultImageModel) projectUpdate.default_image_model = defaultImageModel;

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
                apiKey: apiKey, // return the raw key
                isActive: providerKey.is_active,
                defaultModel: providerKey.default_model,
                defaultImageModel: providerKey.default_image_model,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('[API] Error saving provider key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
