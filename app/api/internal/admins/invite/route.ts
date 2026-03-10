import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { renderTemplate } from '@/lib/email-templates';
import { allowAllInternalInDev, isFounderEmail } from '@/lib/internal-admin-auth';
import { resolvePublicOrigin } from '@/lib/public-origin';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_INVITE_FROM_EMAIL = process.env.RESEND_ADMIN_INVITE_FROM_EMAIL || process.env.RESEND_TEAM_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '';
const ADMIN_INVITE_REPLY_TO_EMAIL = process.env.RESEND_ADMIN_INVITE_REPLY_TO_EMAIL || process.env.RESEND_REPLY_TO_EMAIL || '';

function parseReplyTo(value: string): string | string[] | undefined {
    const addresses = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (addresses.length === 0) {
        return undefined;
    }

    return addresses.length === 1 ? addresses[0] : addresses;
}

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

export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const isFounder = isFounderEmail(user.email);
    const admin = await getSuperAdminStatus(user.id);
    const isAllowed = (allowAllInternalInDev() && isDev) || isFounder || !!admin;

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

    const baseUrl = resolvePublicOrigin(req);
    const inviteLink = `${baseUrl}/internal/invite?token=${invite.invite_token}`;

    try {
        if (!RESEND_API_KEY || !ADMIN_INVITE_FROM_EMAIL) {
            console.warn('[Admins] Resend sender not configured. Skipping invite email.');
        } else {
            const resend = new Resend(RESEND_API_KEY);
            const html = renderTemplate('announcement', {
                subject: "You're invited to join the Cencori team",
                body: `
                    <p style="margin-bottom: 24px;">
                        <strong style="color: #fff;">${user.email?.split('@')[0] || 'A team member'}</strong> has invited you to join the Cencori elite as a 
                        <span style="color: ${role === 'super_admin' ? '#10b981' : '#eee'}; font-weight: bold;">${role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>.
                    </p>
                    <p style="margin-bottom: 0;">As part of the team, you'll help manage our intelligence-driven security infrastructure and RAG-based scanning engine.</p>
                `,
                ctaText: 'Accept Invite',
                ctaUrl: inviteLink,
                footerText: "If you weren't expecting this, you can safely ignore this email.",
            });

            const { error: sendError } = await resend.emails.send({
                from: ADMIN_INVITE_FROM_EMAIL,
                to: email.toLowerCase(),
                replyTo: parseReplyTo(ADMIN_INVITE_REPLY_TO_EMAIL),
                subject: "You're invited to join the Cencori team",
                html,
            });

            if (sendError) {
                console.error('[Admins] Failed to send invite email:', sendError);
            }
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
