import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getBaseUrl } from '@/lib/newsletter';

async function unsubscribeByToken(token: string | null) {
    if (!token) return { ok: false, reason: 'missing_token' as const };

    const admin = createAdminClient();
    const { data: subscriber, error } = await admin
        .from('newsletter_subscribers')
        .select('id, status')
        .eq('unsubscribe_token', token)
        .maybeSingle();

    if (error || !subscriber) return { ok: false, reason: 'invalid_token' as const };

    if (subscriber.status === 'unsubscribed') {
        return { ok: true, alreadyUnsubscribed: true };
    }

    const { error: updateError } = await admin
        .from('newsletter_subscribers')
        .update({
            status: 'unsubscribed',
            unsubscribed_at: new Date().toISOString(),
        })
        .eq('id', subscriber.id);

    if (updateError) {
        console.error('[Newsletter] Unsubscribe update failed:', updateError);
        return { ok: false, reason: 'server' as const };
    }

    return { ok: true };
}

export async function GET(req: NextRequest) {
    const baseUrl = getBaseUrl();
    const result = await unsubscribeByToken(req.nextUrl.searchParams.get('token'));

    if (!result.ok) {
        return NextResponse.redirect(`${baseUrl}/subscribe/unsubscribed?error=${result.reason}`);
    }

    return NextResponse.redirect(
        `${baseUrl}/subscribe/unsubscribed${result.alreadyUnsubscribed ? '?already=1' : ''}`
    );
}

// One-click unsubscribe per RFC 8058 — mail clients POST to the
// List-Unsubscribe URL with no body. Always return 200 on success.
export async function POST(req: NextRequest) {
    const result = await unsubscribeByToken(req.nextUrl.searchParams.get('token'));
    if (!result.ok) {
        return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ success: true });
}
