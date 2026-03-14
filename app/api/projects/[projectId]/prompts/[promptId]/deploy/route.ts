import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; promptId: string }> }
) {
    const { projectId, promptId } = await params;
    const body = await req.json();
    const supabase = createAdminClient();

    const { version_id } = body;

    if (!version_id) {
        return NextResponse.json({ error: 'version_id is required' }, { status: 400 });
    }

    // Verify version belongs to this prompt
    const { data: version } = await supabase
        .from('prompt_versions')
        .select('id, version')
        .eq('id', version_id)
        .eq('prompt_id', promptId)
        .single();

    if (!version) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Update active version
    const { error } = await supabase
        .from('prompt_registry')
        .update({
            active_version_id: version_id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', promptId)
        .eq('project_id', projectId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deployed: true, version: version.version, version_id });
}
