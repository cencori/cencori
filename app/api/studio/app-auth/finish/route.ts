/**
 * POST /api/studio/app-auth/finish  { code, verifier }
 *
 * The app trades the code from /return for its session token, proving with
 * the verifier that it's the app that started (lib/studio/app-auth.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { openCode } from '@/lib/studio/app-auth';

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { code?: unknown; verifier?: unknown } | null;
    const token = openCode(body?.code, body?.verifier);
    if (!token) return NextResponse.json({ error: 'That sign-in expired. Try again.' }, { status: 400 });
    return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
}
