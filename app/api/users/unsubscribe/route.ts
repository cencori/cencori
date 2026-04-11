import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { verifyUserUnsubscribeToken } from '@/lib/user-unsubscribe';
import { getBaseUrl } from '@/lib/newsletter';

type OptOutResult =
    | { ok: true; alreadyUnsubscribed?: boolean }
    | { ok: false; reason: 'missing_token' | 'invalid_token' | 'server' };

async function optOutUser(
    uid: string | null,
    token: string | null,
): Promise<OptOutResult> {
    if (!uid || !token) return { ok: false, reason: 'missing_token' };
    if (!verifyUserUnsubscribeToken(uid, token)) {
        return { ok: false, reason: 'invalid_token' };
    }

    const admin = createAdminClient();
    const { data: userData, error: fetchError } = await admin.auth.admin.getUserById(uid);
    if (fetchError || !userData?.user) {
        return { ok: false, reason: 'invalid_token' };
    }

    const currentMeta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
    if (typeof currentMeta.marketing_opted_out_at === 'string') {
        return { ok: true, alreadyUnsubscribed: true };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(uid, {
        user_metadata: {
            ...currentMeta,
            marketing_opted_out_at: new Date().toISOString(),
        },
    });

    if (updateError) {
        console.error('[UserUnsubscribe] Update failed:', updateError);
        return { ok: false, reason: 'server' };
    }

    return { ok: true };
}

export async function GET(req: NextRequest) {
    const baseUrl = getBaseUrl();
    const result = await optOutUser(
        req.nextUrl.searchParams.get('uid'),
        req.nextUrl.searchParams.get('token'),
    );

    if (!result.ok) {
        return NextResponse.redirect(`${baseUrl}/subscribe/unsubscribed?error=${result.reason}`);
    }

    return NextResponse.redirect(
        `${baseUrl}/subscribe/unsubscribed${result.alreadyUnsubscribed ? '?already=1' : ''}`,
    );
}

// RFC 8058 one-click unsubscribe — mail clients POST to the List-Unsubscribe
// URL with no body. Always return 200 on success so Gmail/Apple Mail mark
// the mailbox as unsubscribed without user interaction.
export async function POST(req: NextRequest) {
    const result = await optOutUser(
        req.nextUrl.searchParams.get('uid'),
        req.nextUrl.searchParams.get('token'),
    );
    if (!result.ok) {
        return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ success: true });
}
