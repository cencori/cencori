import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BROADCAST_FROM_EMAIL =
    process.env.RESEND_BROADCAST_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    '';
const BROADCAST_REPLY_TO_EMAIL =
    process.env.RESEND_BROADCAST_REPLY_TO_EMAIL ||
    process.env.RESEND_REPLY_TO_EMAIL ||
    '';

const ALLOW_ALL_IN_DEV = true;
const FOUNDER_EMAILS = ['omogbolahanng@gmail.com'];
const USERS_PAGE_SIZE = 200;
const SEND_CONCURRENCY = 5;
const SEND_BATCH_PAUSE_MS = 120;
const DEFAULT_MAX_RECIPIENTS = 500;
const HARD_MAX_RECIPIENTS = 2000;

interface BroadcastRequestBody {
    subject?: string;
    html?: string;
    text?: string;
    dryRun?: boolean;
    includeUnconfirmed?: boolean;
    maxRecipients?: number;
    testRecipient?: string;
}

interface AudienceRecipient {
    email: string;
    confirmed: boolean;
}

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

function normalizeOptionalEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (!normalized.includes('@')) return null;
    return normalized;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

async function getAudienceRecipients(
    includeUnconfirmed: boolean,
    maxRecipients: number
): Promise<{ recipients: AudienceRecipient[]; totalFetchedUsers: number }> {
    const supabaseAdmin = createAdminClient();
    const dedupe = new Set<string>();
    const recipients: AudienceRecipient[] = [];
    let totalFetchedUsers = 0;
    let page = 1;

    while (recipients.length < maxRecipients) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: USERS_PAGE_SIZE,
        });

        if (error) {
            throw new Error(error.message || 'Failed to list users');
        }

        const users = data?.users ?? [];
        totalFetchedUsers += users.length;

        for (const user of users) {
            const normalized = normalizeOptionalEmail(user.email);
            if (!normalized || dedupe.has(normalized)) {
                continue;
            }

            const isConfirmed = Boolean(user.email_confirmed_at);
            if (!includeUnconfirmed && !isConfirmed) {
                continue;
            }

            dedupe.add(normalized);
            recipients.push({
                email: normalized,
                confirmed: isConfirmed,
            });

            if (recipients.length >= maxRecipients) {
                break;
            }
        }

        if (!data?.nextPage || users.length === 0) {
            break;
        }

        page = data.nextPage;
    }

    return { recipients, totalFetchedUsers };
}

export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const isFounder = FOUNDER_EMAILS.includes((user.email || '').toLowerCase());
    const admin = await getSuperAdminStatus(user.id);
    const isAllowed = (ALLOW_ALL_IN_DEV && isDev) || isFounder || !!admin;

    if (!isAllowed) {
        return NextResponse.json(
            { error: 'Forbidden - Super admin access required' },
            { status: 403 }
        );
    }

    let body: BroadcastRequestBody;
    try {
        body = (await req.json()) as BroadcastRequestBody;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const dryRun = body.dryRun !== false;
    const includeUnconfirmed = body.includeUnconfirmed === true;
    const maxRecipientsRaw = Number.isFinite(body.maxRecipients)
        ? Math.floor(Number(body.maxRecipients))
        : DEFAULT_MAX_RECIPIENTS;
    const maxRecipients = Math.min(
        Math.max(maxRecipientsRaw, 1),
        HARD_MAX_RECIPIENTS
    );
    const testRecipient = normalizeOptionalEmail(body.testRecipient);

    const subject = (body.subject || '').trim();
    const html = (body.html || '').trim();
    const text = typeof body.text === 'string' ? body.text.trim() : undefined;

    if (!subject) {
        return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    if (!html) {
        return NextResponse.json({ error: 'HTML body is required' }, { status: 400 });
    }

    if (subject.length > 180) {
        return NextResponse.json({ error: 'Subject is too long' }, { status: 400 });
    }

    if (html.length > 200_000) {
        return NextResponse.json({ error: 'HTML body is too large' }, { status: 400 });
    }

    if (testRecipient) {
        if (!RESEND_API_KEY || !BROADCAST_FROM_EMAIL) {
            return NextResponse.json(
                { error: 'Broadcast email sender is not configured' },
                { status: 500 }
            );
        }

        try {
            const resend = new Resend(RESEND_API_KEY);
            const { data, error } = await resend.emails.send({
                from: BROADCAST_FROM_EMAIL,
                to: testRecipient,
                replyTo: parseReplyTo(BROADCAST_REPLY_TO_EMAIL),
                subject,
                html,
                text: text || undefined,
            });

            if (error) {
                return NextResponse.json(
                    { error: error.message || 'Failed to send test email' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                mode: 'test',
                recipient: testRecipient,
                id: data?.id,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send test email';
            return NextResponse.json({ error: message }, { status: 500 });
        }
    }

    let recipients: AudienceRecipient[] = [];
    let totalFetchedUsers = 0;
    try {
        const audienceResult = await getAudienceRecipients(includeUnconfirmed, maxRecipients);
        recipients = audienceResult.recipients;
        totalFetchedUsers = audienceResult.totalFetchedUsers;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch audience';
        return NextResponse.json({ error: message }, { status: 500 });
    }

    if (dryRun) {
        return NextResponse.json({
            success: true,
            dryRun: true,
            subject,
            includeUnconfirmed,
            maxRecipients,
            totalFetchedUsers,
            eligibleRecipients: recipients.length,
            sampleRecipients: recipients.slice(0, 25).map((recipient) => recipient.email),
            capped: recipients.length >= maxRecipients,
        });
    }

    if (!RESEND_API_KEY || !BROADCAST_FROM_EMAIL) {
        return NextResponse.json(
            { error: 'Broadcast email sender is not configured' },
            { status: 500 }
        );
    }

    if (recipients.length === 0) {
        return NextResponse.json({
            success: true,
            dryRun: false,
            sent: 0,
            failed: 0,
            message: 'No eligible recipients found',
        });
    }

    const resend = new Resend(RESEND_API_KEY);
    let sent = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (let index = 0; index < recipients.length; index += SEND_CONCURRENCY) {
        const slice = recipients.slice(index, index + SEND_CONCURRENCY);
        const results = await Promise.all(
            slice.map(async (recipient) => {
                const { error } = await resend.emails.send({
                    from: BROADCAST_FROM_EMAIL,
                    to: recipient.email,
                    replyTo: parseReplyTo(BROADCAST_REPLY_TO_EMAIL),
                    subject,
                    html,
                    text: text || undefined,
                });

                if (error) {
                    return {
                        ok: false as const,
                        email: recipient.email,
                        error: error.message || 'Unknown send failure',
                    };
                }

                return {
                    ok: true as const,
                    email: recipient.email,
                };
            })
        );

        for (const result of results) {
            if (result.ok) {
                sent += 1;
            } else {
                failures.push({ email: result.email, error: result.error });
            }
        }

        if (index + SEND_CONCURRENCY < recipients.length) {
            await sleep(SEND_BATCH_PAUSE_MS);
        }
    }

    return NextResponse.json({
        success: failures.length === 0,
        dryRun: false,
        includeUnconfirmed,
        maxRecipients,
        totalFetchedUsers,
        attempted: recipients.length,
        sent,
        failed: failures.length,
        failureSample: failures.slice(0, 20),
        capped: recipients.length >= maxRecipients,
    });
}
