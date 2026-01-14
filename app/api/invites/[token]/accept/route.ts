import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

// POST /api/invites/[token]/accept - Accept an invite
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized - Please log in first' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // Find the invite
    console.log('[Invites Accept] Looking for invite with token:', token);
    const { data: invite, error: inviteError } = await supabaseAdmin
        .from('organization_invites')
        .select('*, organizations(name, slug)')
        .eq('invite_token', token)
        .single();

    if (inviteError) {
        console.error('[Invites Accept] Error finding invite:', inviteError);
        return NextResponse.json({ error: 'Invalid invite link', details: inviteError.message }, { status: 404 });
    }

    if (!invite) {
        console.error('[Invites Accept] No invite found for token');
        return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    console.log('[Invites Accept] Found invite for:', invite.email, 'org:', invite.organization_id);

    // Check if already accepted
    if (invite.accepted_at) {
        return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
    }

    // Check if email matches (case-insensitive)
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
        return NextResponse.json({
            error: `This invite was sent to ${invite.email}. Please log in with that email address.`
        }, { status: 403 });
    }

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', invite.organization_id)
        .eq('user_id', user.id)
        .single();

    if (existingMember) {
        // Already a member, just mark invite as accepted
        await supabaseAdmin
            .from('organization_invites')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', invite.id);

        return NextResponse.json({
            success: true,
            message: 'You are already a member of this organization',
            organizationSlug: invite.organizations?.slug,
        });
    }

    // Add user to organization
    const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
            organization_id: invite.organization_id,
            user_id: user.id,
            role: invite.role,
        });

    if (memberError) {
        console.error('[Invites] Error adding member:', memberError);
        return NextResponse.json({ error: 'Failed to join organization' }, { status: 500 });
    }

    // Mark invite as accepted
    await supabaseAdmin
        .from('organization_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

    return NextResponse.json({
        success: true,
        message: `Welcome to ${invite.organizations?.name || 'the organization'}!`,
        organizationSlug: invite.organizations?.slug,
    });
}

// GET /api/invites/[token]/accept - Get invite details (for the accept page)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const supabaseAdmin = createAdminClient();

    // Find the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
        .from('organization_invites')
        .select('email, role, expires_at, accepted_at, organizations(name)')
        .eq('invite_token', token)
        .single();

    if (inviteError || !invite) {
        return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    if (invite.accepted_at) {
        return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
    }

    return NextResponse.json({
        email: invite.email,
        role: invite.role,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        organizationName: (invite.organizations as any)?.name,
    });
}
