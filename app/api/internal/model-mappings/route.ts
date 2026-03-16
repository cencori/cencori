import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { allowAllInternalInDev, isFounderEmail } from '@/lib/internal-admin-auth';

async function verifyAdmin(userId: string, userEmail: string | undefined) {
    const isDev = process.env.NODE_ENV === 'development';
    if (allowAllInternalInDev() && isDev) return true;
    if (isFounderEmail(userEmail)) return true;

    const supabase = createAdminClient();
    const { data } = await supabase
        .from('cencori_admins')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
    return !!data;
}

// GET — list all model mappings
export async function GET() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await verifyAdmin(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from('model_mappings')
        .select('*')
        .order('source_model', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ mappings: data });
}

// POST — create a new mapping
export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await verifyAdmin(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { source_model, target_provider, target_model } = body;

    if (!source_model || !target_provider || !target_model) {
        return NextResponse.json({ error: 'source_model, target_provider, and target_model are required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
        .from('model_mappings')
        .upsert(
            { source_model, target_provider, target_model, created_by: user.id, updated_at: new Date().toISOString() },
            { onConflict: 'source_model,target_provider' }
        )
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ mapping: data }, { status: 201 });
}

// DELETE — delete a mapping by id
export async function DELETE(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await verifyAdmin(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
        .from('model_mappings')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
