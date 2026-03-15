import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isCencoriEmail } from '@/lib/internal-access';
import { trackEvent } from '@/lib/track-event';

export async function POST(req: NextRequest) {
    const { email, password } = await req.json();

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();

    if (!isCencoriEmail(trimmed)) {
        return NextResponse.json({ error: 'Only @cencori.com emails allowed' }, { status: 403 });
    }

    if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Create user with auto-confirmed email (no verification needed)
    const { data, error } = await admin.auth.admin.createUser({
        email: trimmed,
        password,
        email_confirm: true,
    });

    if (error) {
        // User might already exist
        if (error.message?.includes('already been registered')) {
            return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackEvent({ event_type: 'user.signup', product: 'dashboard', user_id: data.user.id, metadata: { email: trimmed } });

    return NextResponse.json({ success: true, userId: data.user.id });
}
