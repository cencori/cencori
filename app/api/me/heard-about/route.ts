/**
 * GET  /api/me/heard-about  → { answered }
 * POST /api/me/heard-about  { source, detail?, surface }
 *
 * The signed-in person's answer to "How did you hear about us?", kept on
 * their user (user_metadata.heard_about). The first answer stands; asking
 * again elsewhere doesn't overwrite it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { adminUsers } from '@/lib/auth/admin-users';
import { isHeardAboutSource, readHeardAbout, type HeardAbout } from '@/lib/heard-about';

async function signedIn() {
    const { data: { user } } = await getAuthUser(await createServerClient());
    if (!user) return null;
    // The stored metadata, not the session's copy, so a fresh answer is seen.
    const { data } = await adminUsers.getUserById(user.id);
    return { id: user.id, metadata: (data?.user?.user_metadata ?? user.user_metadata ?? {}) as Record<string, unknown> };
}

export async function GET() {
    const user = await signedIn();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ answered: !!readHeardAbout(user.metadata) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
    const user = await signedIn();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null) as { source?: unknown; detail?: unknown; surface?: unknown } | null;
    if (!isHeardAboutSource(body?.source)) return NextResponse.json({ error: 'Pick where you heard about us.' }, { status: 400 });
    if (readHeardAbout(user.metadata)) return NextResponse.json({ saved: false, answered: true });
    const answer: HeardAbout = {
        source: body.source,
        detail: typeof body.detail === 'string' && body.detail.trim() ? body.detail.trim().slice(0, 200) : null,
        surface: body.surface === 'studio_setup' ? 'studio_setup' : 'onboarding',
        at: new Date().toISOString(),
    };
    const { error } = await adminUsers.updateUserById(user.id, { user_metadata: { ...user.metadata, heard_about: answer } });
    if (error) return NextResponse.json({ error: 'Couldn\'t save that. Try again.' }, { status: 502 });
    return NextResponse.json({ saved: true, answered: true });
}
