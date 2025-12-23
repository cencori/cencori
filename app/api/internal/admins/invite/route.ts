import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

// For development, allow all authenticated users temporarily
const ALLOW_ALL_IN_DEV = true;

// Helper to check if user is a super_admin
async function getSuperAdminStatus(userId: string) {
    const supabase = createAdminClient();
    const { data: admin } = await supabase
        .from('cencori_admins')
        .select('id, role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('role', 'super_admin')
        .single();
    return admin;
}

// POST /api/internal/admins/invite - Invite a new admin
export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dev mode bypass or super_admin check
    const isDev = process.env.NODE_ENV === 'development';
    const admin = await getSuperAdminStatus(user.id);
    const isAllowed = (ALLOW_ALL_IN_DEV && isDev) || !!admin;

    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, role = 'admin' } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!['admin', 'super_admin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Check if already invited
    const { data: existing } = await supabaseAdmin
        .from('cencori_admins')
        .select('id, status')
        .eq('email', email.toLowerCase())
        .single();

    if (existing) {
        return NextResponse.json({
            error: existing.status === 'active'
                ? 'User is already an admin'
                : 'User has already been invited'
        }, { status: 400 });
    }

    // Create invite
    const { data: invite, error: inviteError } = await supabaseAdmin
        .from('cencori_admins')
        .insert({
            email: email.toLowerCase(),
            role,
            status: 'pending',
            invited_by: user.id,
        })
        .select('id, invite_token')
        .single();

    if (inviteError) {
        console.error('[Admins] Error creating invite:', inviteError);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    // Generate invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/internal/invite?token=${invite.invite_token}`;

    // Send invite email via Resend
    try {
        const { error: emailError } = await resend.emails.send({
            from: 'Cencori <team@cencori.com>',
            to: email.toLowerCase(),
            subject: "You're invited to join the Cencori team",
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #fafafa; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0a0a;">
    <div style="background: #141414; border-radius: 12px; padding: 32px; border: 1px solid rgba(255,255,255,0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://cencori.com/clight.png" alt="Cencori" style="height: 28px; margin-bottom: 20px; opacity: 0.9;" />
            <p style="color: #888; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; margin: 0 0 6px 0;">Team Invite</p>
            <h1 style="color: #fafafa; margin: 0; font-size: 18px; font-weight: 600;">You're Invited</h1>
        </div>
        
        <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05);">
            <p style="margin: 0; color: #a1a1a1; font-size: 13px; text-align: center;">
                <span style="color: #fafafa;">${user.email?.split('@')[0] || 'A team member'}</span> invited you to join Cencori as
            </p>
            <p style="margin: 8px 0 0 0; text-align: center;">
                <span style="display: inline-block; background: ${role === 'super_admin' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)'}; color: ${role === 'super_admin' ? '#10b981' : '#fafafa'}; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 500;">${role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
            </p>
        </div>
        
        <div style="text-align: center; margin-bottom: 20px;">
            <a href="${inviteLink}" style="display: inline-block; background: #fafafa; color: #0a0a0a; padding: 10px 28px; text-decoration: none; border-radius: 100px; font-weight: 500; font-size: 13px;">Accept Invite</a>
        </div>
        
        <p style="font-size: 11px; color: #555; text-align: center; margin: 0;">
            If you weren't expecting this, ignore this email.
        </p>
    </div>
    
    <div style="text-align: center; margin-top: 16px; color: #444; font-size: 10px;">
        <p style="margin: 0;">© ${new Date().getFullYear()} Cencori</p>
    </div>
</body>
</html>
            `,
        });

        if (emailError) {
            console.error('[Admins] Failed to send invite email:', emailError);
            // Don't fail the request, invite was still created
        }
    } catch (emailErr) {
        console.error('[Admins] Email sending error:', emailErr);
    }

    return NextResponse.json({
        success: true,
        inviteLink,
        message: `Invite sent to ${email}!`
    });
}

