import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

// POST /api/internal/admins/accept - Accept an invite
export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized - Please log in first' }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
        return NextResponse.json({ error: 'Invite token is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Find the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
        .from('cencori_admins')
        .select('id, email, status')
        .eq('invite_token', token)
        .single();

    if (inviteError || !invite) {
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
    }

    if (invite.status === 'active') {
        return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 });
    }

    if (invite.status === 'revoked') {
        return NextResponse.json({ error: 'Invite has been revoked' }, { status: 400 });
    }

    // Verify the user's email matches the invite
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        return NextResponse.json({
            error: `This invite is for ${invite.email}. Please log in with that email.`
        }, { status: 403 });
    }

    // Accept the invite
    const { error: updateError } = await supabaseAdmin
        .from('cencori_admins')
        .update({
            user_id: user.id,
            status: 'active',
            accepted_at: new Date().toISOString(),
            invite_token: null, // Clear the token after use
        })
        .eq('id', invite.id);

    if (updateError) {
        console.error('[Admins] Error accepting invite:', updateError);
        return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        message: 'Welcome to the Cencori team! You now have admin access.'
    });
}
