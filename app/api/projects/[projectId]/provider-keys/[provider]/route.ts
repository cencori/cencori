import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/encryption';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; provider: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { projectId, provider } = await params;
        const body = await req.json();
        const { apiKey, isActive } = body;

        const { data: project } = await supabase
            .from('projects')
            .select('organization_id')
            .eq('id', projectId)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (apiKey) {
            updateData.encrypted_key = encryptApiKey(apiKey, project.organization_id);
            updateData.key_hint = apiKey.length > 4 ? `...${apiKey.slice(-4)}` : '****';
        }
        if (typeof isActive === 'boolean') {
            updateData.is_active = isActive;
        }

        const { data: providerKey, error } = await supabase
            .from('provider_keys')
            .update(updateData)
            .eq('project_id', projectId)
            .eq('provider', provider)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!providerKey) {
            return NextResponse.json({ error: 'Provider key not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            provider: {
                provider: providerKey.provider,
                keyHint: providerKey.key_hint,
                isActive: providerKey.is_active,
            },
        });
    } catch (error) {
        console.error('[API] Error updating provider key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; provider: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { projectId, provider } = await params;

        const { error } = await supabase
            .from('provider_keys')
            .delete()
            .eq('project_id', projectId)
            .eq('provider', provider);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting provider key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
