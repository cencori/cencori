import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; providerId: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { projectId, providerId } = await params;

        const { data: provider, error } = await supabase
            .from('custom_providers')
            .select(`
                id,
                name,
                base_url,
                api_format,
                is_active,
                created_at,
                custom_models(id, model_name, display_name, is_active)
            `)
            .eq('id', providerId)
            .eq('project_id', projectId)
            .single();

        if (error || !provider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        return NextResponse.json({ provider });
    } catch (error) {
        console.error('[API] Error fetching provider:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; providerId: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { projectId, providerId } = await params;
        const body = await req.json();
        const { name, baseUrl, isActive, format } = body;

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (baseUrl !== undefined) updateData.base_url = baseUrl;
        if (isActive !== undefined) updateData.is_active = isActive;
        if (format !== undefined) updateData.api_format = format;
        updateData.updated_at = new Date().toISOString();

        const { data: provider, error } = await supabase
            .from('custom_providers')
            .update(updateData)
            .eq('id', providerId)
            .eq('project_id', projectId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ provider });
    } catch (error) {
        console.error('[API] Error updating provider:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; providerId: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { projectId, providerId } = await params;

        const { error } = await supabase
            .from('custom_providers')
            .delete()
            .eq('id', providerId)
            .eq('project_id', projectId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting provider:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
