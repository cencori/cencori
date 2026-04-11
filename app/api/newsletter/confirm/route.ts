import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getBaseUrl } from '@/lib/newsletter';

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token');
    const baseUrl = getBaseUrl();

    if (!token) {
        return NextResponse.redirect(`${baseUrl}/subscribe/confirmed?error=missing_token`);
    }

    const admin = createAdminClient();

    const { data: subscriber, error } = await admin
        .from('newsletter_subscribers')
        .select('id, status')
        .eq('confirmation_token', token)
        .maybeSingle();

    if (error || !subscriber) {
        return NextResponse.redirect(`${baseUrl}/subscribe/confirmed?error=invalid_token`);
    }

    if (subscriber.status === 'confirmed') {
        return NextResponse.redirect(`${baseUrl}/subscribe/confirmed?already=1`);
    }

    if (subscriber.status === 'unsubscribed') {
        return NextResponse.redirect(`${baseUrl}/subscribe/confirmed?error=unsubscribed`);
    }

    const { error: updateError } = await admin
        .from('newsletter_subscribers')
        .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
        })
        .eq('id', subscriber.id);

    if (updateError) {
        console.error('[Newsletter] Confirm update failed:', updateError);
        return NextResponse.redirect(`${baseUrl}/subscribe/confirmed?error=server`);
    }

    return NextResponse.redirect(`${baseUrl}/subscribe/confirmed`);
}
