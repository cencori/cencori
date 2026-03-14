import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { slugify } from '@/lib/prompts/registry';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; promptId: string }> }
) {
    const { projectId, promptId } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('prompt_registry')
        .select('*')
        .eq('id', promptId)
        .eq('project_id', projectId)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // Get active version
    let activeVersion = null;
    if (data.active_version_id) {
        const { data: version } = await supabase
            .from('prompt_versions')
            .select('*')
            .eq('id', data.active_version_id)
            .single();
        activeVersion = version;
    }

    // Get version count
    const { count } = await supabase
        .from('prompt_versions')
        .select('id', { count: 'exact', head: true })
        .eq('prompt_id', promptId);

    return NextResponse.json({
        ...data,
        active_version: activeVersion,
        version_count: count || 0,
    });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; promptId: string }> }
) {
    const { projectId, promptId } = await params;
    const body = await req.json();
    const supabase = createAdminClient();

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (typeof body.name === 'string' && body.name.trim().length >= 2) {
        updates.name = body.name.trim();
        updates.slug = slugify(body.name.trim());
    }
    if (typeof body.description === 'string') updates.description = body.description;
    if (Array.isArray(body.tags)) updates.tags = body.tags;

    const { data, error } = await supabase
        .from('prompt_registry')
        .update(updates)
        .eq('id', promptId)
        .eq('project_id', projectId)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'A prompt with this name already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; promptId: string }> }
) {
    const { projectId, promptId } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('prompt_registry')
        .delete()
        .eq('id', promptId)
        .eq('project_id', projectId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
}
