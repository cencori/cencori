import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { allowAllInternalInDev, isFounderEmail } from '@/lib/internal-admin-auth';

async function checkAdminAccess(userId: string, userEmail: string | undefined) {
    const isDev = process.env.NODE_ENV === 'development';
    if (allowAllInternalInDev() && isDev) return true;
    if (isFounderEmail(userEmail)) return true;

    const supabase = createAdminClient();
    const { data: admin } = await supabase
        .from('cencori_admins')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
    return !!admin;
}

// GET — list sender profiles
export async function GET() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await checkAdminAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from('email_sender_profiles')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profiles: data || [] });
}

// POST — create or update sender profile
export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await checkAdminAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const displayName = (body.displayName || '').trim();
    const emailHandle = (body.emailHandle || '').trim().toLowerCase();
    const isDefault = body.isDefault === true;
    const profileId = body.id || null;

    if (!displayName || displayName.length > 100) {
        return NextResponse.json({ error: 'Display name is required (max 100 chars)' }, { status: 400 });
    }

    if (!emailHandle || !/^[a-z0-9._-]+$/.test(emailHandle)) {
        return NextResponse.json({ error: 'Email handle must be lowercase alphanumeric (e.g. "samuel")' }, { status: 400 });
    }

    const admin = createAdminClient();

    // If setting as default, unset other defaults first
    if (isDefault) {
        await admin
            .from('email_sender_profiles')
            .update({ is_default: false })
            .neq('id', profileId || '00000000-0000-0000-0000-000000000000');
    }

    if (profileId) {
        // Update existing
        const { data, error } = await admin
            .from('email_sender_profiles')
            .update({
                display_name: displayName,
                email_handle: emailHandle,
                is_default: isDefault,
                updated_at: new Date().toISOString(),
            })
            .eq('id', profileId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ profile: data });
    }

    // Create new
    const { data, error } = await admin
        .from('email_sender_profiles')
        .insert({
            user_id: user.id,
            display_name: displayName,
            email_handle: emailHandle,
            is_default: isDefault,
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'This email handle is already in use' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data }, { status: 201 });
}

// DELETE — remove sender profile
export async function DELETE(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await checkAdminAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('id');

    if (!profileId) {
        return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
        .from('email_sender_profiles')
        .delete()
        .eq('id', profileId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
