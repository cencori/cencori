import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { allowAllInternalInDev, isFounderEmail } from '@/lib/internal-admin-auth';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FALLBACK_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
const FALLBACK_REPLY_TO = process.env.RESEND_REPLY_TO_EMAIL || '';
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'cencori.com';

const SEND_CONCURRENCY = 5;
const SEND_BATCH_PAUSE_MS = 120;
const USERS_PAGE_SIZE = 200;
const HARD_MAX_RECIPIENTS = 2000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

interface SendEmailRequest {
    subject: string;
    htmlBody: string;
    textBody?: string;
    category: string;
    senderProfileId?: string;
    audienceType: 'bulk' | 'single';
    singleRecipient?: string;
    maxRecipients?: number;
}

async function getSenderFrom(profileId?: string): Promise<string> {
    if (!profileId) return FALLBACK_FROM_EMAIL;

    const admin = createAdminClient();
    const { data } = await admin
        .from('email_sender_profiles')
        .select('display_name, email_handle')
        .eq('id', profileId)
        .single();

    if (!data) return FALLBACK_FROM_EMAIL;

    return `${data.display_name} <${data.email_handle}@${EMAIL_DOMAIN}>`;
}

async function getAllRecipients(maxRecipients: number): Promise<string[]> {
    const supabaseAdmin = createAdminClient();
    const dedupe = new Set<string>();
    const recipients: string[] = [];
    let page = 1;

    while (recipients.length < maxRecipients) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: USERS_PAGE_SIZE,
        });

        if (error) throw new Error(error.message);

        const users = data?.users ?? [];
        for (const user of users) {
            const email = user.email?.trim().toLowerCase();
            if (!email || dedupe.has(email)) continue;
            if (!user.email_confirmed_at) continue;

            dedupe.add(email);
            recipients.push(email);
            if (recipients.length >= maxRecipients) break;
        }

        if (!data?.nextPage || users.length === 0) break;
        page = data.nextPage;
    }

    return recipients;
}

export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await checkAdminAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: SendEmailRequest;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { subject, htmlBody, textBody, category, senderProfileId, audienceType, singleRecipient } = body;

    if (!subject?.trim()) {
        return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    if (!htmlBody?.trim()) {
        return NextResponse.json({ error: 'Email body is required' }, { status: 400 });
    }

    if (!RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const fromAddress = await getSenderFrom(senderProfileId);
    if (!fromAddress) {
        return NextResponse.json({ error: 'No sender email configured' }, { status: 500 });
    }

    const admin = createAdminClient();
    const resend = new Resend(RESEND_API_KEY);

    // === Single Send (test / individual) ===
    if (audienceType === 'single') {
        const recipient = singleRecipient?.trim().toLowerCase();
        if (!recipient || !recipient.includes('@')) {
            return NextResponse.json({ error: 'Valid recipient email is required for single send' }, { status: 400 });
        }

        // Record in DB
        const { data: sendRecord, error: insertError } = await admin
            .from('email_sends')
            .insert({
                category: category || 'transactional',
                subject: subject.trim(),
                html_body: htmlBody,
                text_body: textBody || null,
                sender_profile_id: senderProfileId || null,
                sent_by: user.id,
                audience_type: 'single',
                single_recipient: recipient,
                recipient_count: 1,
                status: 'sending',
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('[Email Send] Failed to record send:', insertError);
        }

        try {
            const { error: sendError } = await resend.emails.send({
                from: fromAddress,
                to: recipient,
                replyTo: FALLBACK_REPLY_TO || undefined,
                subject: subject.trim(),
                html: htmlBody,
                text: textBody || undefined,
            });

            if (sendError) {
                if (sendRecord?.id) {
                    await admin.from('email_sends').update({
                        status: 'failed', failure_count: 1, sent_at: new Date().toISOString(),
                    }).eq('id', sendRecord.id);
                }
                return NextResponse.json({ error: sendError.message }, { status: 500 });
            }

            if (sendRecord?.id) {
                await admin.from('email_sends').update({
                    status: 'sent', success_count: 1, sent_at: new Date().toISOString(),
                }).eq('id', sendRecord.id);
            }

            return NextResponse.json({ success: true, recipient, mode: 'single' });
        } catch (err) {
            if (sendRecord?.id) {
                await admin.from('email_sends').update({
                    status: 'failed', failure_count: 1, sent_at: new Date().toISOString(),
                }).eq('id', sendRecord.id);
            }
            const message = err instanceof Error ? err.message : 'Send failed';
            return NextResponse.json({ error: message }, { status: 500 });
        }
    }

    // === Bulk Send ===
    const maxRecipients = Math.min(
        Math.max(Number(body.maxRecipients) || 500, 1),
        HARD_MAX_RECIPIENTS
    );

    let recipients: string[];
    try {
        recipients = await getAllRecipients(maxRecipients);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch audience';
        return NextResponse.json({ error: message }, { status: 500 });
    }

    if (recipients.length === 0) {
        return NextResponse.json({ success: true, sent: 0, message: 'No eligible recipients found' });
    }

    // Record in DB
    const { data: sendRecord } = await admin
        .from('email_sends')
        .insert({
            category: category || 'announcement',
            subject: subject.trim(),
            html_body: htmlBody,
            text_body: textBody || null,
            sender_profile_id: senderProfileId || null,
            sent_by: user.id,
            audience_type: 'bulk',
            recipient_count: recipients.length,
            status: 'sending',
        })
        .select('id')
        .single();

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
        const slice = recipients.slice(i, i + SEND_CONCURRENCY);
        const results = await Promise.all(
            slice.map(async (recipient) => {
                const { error } = await resend.emails.send({
                    from: fromAddress,
                    to: recipient,
                    replyTo: FALLBACK_REPLY_TO || undefined,
                    subject: subject.trim(),
                    html: htmlBody,
                    text: textBody || undefined,
                });
                return { ok: !error, email: recipient };
            })
        );

        for (const r of results) {
            if (r.ok) sent++;
            else failed++;
        }

        if (i + SEND_CONCURRENCY < recipients.length) {
            await sleep(SEND_BATCH_PAUSE_MS);
        }
    }

    if (sendRecord?.id) {
        await admin.from('email_sends').update({
            status: failed === 0 ? 'sent' : 'sent',
            success_count: sent,
            failure_count: failed,
            sent_at: new Date().toISOString(),
        }).eq('id', sendRecord.id);
    }

    return NextResponse.json({
        success: true,
        mode: 'bulk',
        recipientCount: recipients.length,
        sent,
        failed,
    });
}
