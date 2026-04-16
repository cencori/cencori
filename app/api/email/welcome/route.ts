import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const WELCOME_FROM_EMAIL = process.env.RESEND_WELCOME_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '';
const WELCOME_REPLY_TO_EMAIL = process.env.RESEND_WELCOME_REPLY_TO_EMAIL || process.env.RESEND_REPLY_TO_EMAIL || '';

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

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let requestedEmail: string | null = null;
    try {
      const body = await request.json();
      if (typeof body?.email === 'string') {
        requestedEmail = body.email;
      }
    } catch {
      // JSON body is optional.
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    if (requestedEmail && requestedEmail.trim().toLowerCase() !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!RESEND_API_KEY) {
      console.warn('[Welcome Email] RESEND_API_KEY not configured. Skipping send.');
      return NextResponse.json({ success: false, skipped: true, reason: 'email_not_configured' }, { status: 202 });
    }

    if (!WELCOME_FROM_EMAIL) {
      console.warn('[Welcome Email] RESEND_WELCOME_FROM_EMAIL/RESEND_FROM_EMAIL not configured. Skipping send.');
      return NextResponse.json({ success: false, skipped: true, reason: 'from_email_not_configured' }, { status: 202 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: adminUserData, error: adminUserError } = await supabaseAdmin.auth.admin.getUserById(user.id);
    if (adminUserError || !adminUserData?.user) {
      console.error('[Welcome Email] Failed to load user metadata:', adminUserError);
      return NextResponse.json({ error: 'Failed to load user metadata' }, { status: 500 });
    }

    const currentUserMetadata = (adminUserData.user.user_metadata ?? {}) as Record<string, unknown>;
    const existingWelcomeSentAt = currentUserMetadata.welcome_email_sent_at;
    if (typeof existingWelcomeSentAt === 'string' && existingWelcomeSentAt.length > 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'already_sent',
        sentAt: existingWelcomeSentAt,
      });
    }

    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: WELCOME_FROM_EMAIL,
      to: normalizedEmail,
      replyTo: parseReplyTo(WELCOME_REPLY_TO_EMAIL),
      subject: 'Welcome to Cencori!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <img src="https://cencori.com/logos/logo-w.png" alt="Cencori" style="height: 48px; margin-bottom: 24px;" />
              <h1 style="color: #000; margin-bottom: 8px;">Welcome to Cencori!</h1>
              <p style="color: #666; font-size: 18px; margin: 0;">You're all set to build with AI infrastructure.</p>
            </div>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
              <h2 style="margin-top: 0; font-size: 16px;">Get started in 3 steps:</h2>
              <ol style="margin: 0; padding-left: 20px; color: #555;">
                <li style="margin-bottom: 8px;">Create your first organization</li>
                <li style="margin-bottom: 8px;">Set up a project and get your API key</li>
                <li style="margin-bottom: 8px;">Make your first AI request</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin-bottom: 32px;">
              <a href="https://cencori.com/dashboard/organizations" style="display: inline-block; background: #000; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">Go to Dashboard</a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 24px; margin-top: 32px;">
              <h3 style="font-size: 14px; margin-bottom: 12px;">Helpful Resources</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555; font-size: 14px;">
                <li><a href="https://cencori.com/docs" style="color: #000;">Documentation</a></li>
                <li><a href="https://cencori.com/docs/quick-start" style="color: #000;">Quick Start Guide</a></li>
                <li><a href="https://cencori.com/docs/api" style="color: #000;">API Reference</a></li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 40px; color: #999; font-size: 12px;">
              <p>Need help? Reply to this email or contact <a href="mailto:support@cencori.com" style="color: #666;">support@cencori.com</a></p>
              <p style="margin-top: 16px;">© ${new Date().getFullYear()} Cencori. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Welcome email error:', error);
      return NextResponse.json(
        { error: 'Failed to send welcome email' },
        { status: 500 }
      );
    }

    const { error: metadataUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...currentUserMetadata,
        welcome_email_sent_at: new Date().toISOString(),
      },
    });

    if (metadataUpdateError) {
      console.error('[Welcome Email] Failed to persist send marker:', metadataUpdateError);
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Welcome email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
