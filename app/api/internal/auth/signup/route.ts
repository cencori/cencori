import { NextResponse } from 'next/server';

// Closed 2026-10-31. It created a pre-confirmed account for any @cencori.com
// address without proving the caller owned it, and checkInternalAccess grants
// staff access to every @cencori.com email, so anyone could make themselves
// staff. Staff now sign up through the normal flow (email verified) or are
// invited from /internal/settings.
export async function POST() {
    return NextResponse.json(
        { error: 'Internal signup is closed. Sign up normally or ask for an invite.' },
        { status: 410 }
    );
}
