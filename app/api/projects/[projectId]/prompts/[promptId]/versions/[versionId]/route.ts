import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; promptId: string; versionId: string }> }
) {
    const { promptId, versionId } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('id', versionId)
        .eq('prompt_id', promptId)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json(data);
}
