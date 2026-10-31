/**
 * GET /api/studio/brief/voice?project_id=&at=
 *
 * This morning's brief read aloud (mp3), made only when the owner taps
 * Listen, in a Nigerian English voice (Spitch). `at` is the brief's time: a
 * new brief is a new address, so the phone keeps each one's audio for the day
 * and replaying it doesn't make (or pay for) it again.
 */

import { businessTimeZone } from '@/lib/studio/business-zone';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { latestBrief, briefScript } from '@/lib/studio/brief';
import { generateSpeech, SpeechRequestError } from '@/lib/audio/speech';
import type { GatewayContext } from '@/lib/gateway-middleware';

const VOICE = { model: 'spitch-tts', voice: 'henry', language: 'en' } as const;

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();

    const brief = await latestBrief(db, projectId, await businessTimeZone(db, projectId));
    if (!brief) return NextResponse.json({ error: 'No brief this morning.' }, { status: 404 });

    try {
        // Our key, not the business's: the brief is Cencori's, not a call the business made.
        const ctx = { supabase: db, projectId: '00000000-0000-0000-0000-000000000000', organizationId: access.organizationId } as unknown as GatewayContext;
        const speech = await generateSpeech(ctx, { input: briefScript(brief), ...VOICE, response_format: 'mp3' });
        return new NextResponse(speech.audio, {
            headers: { 'Content-Type': speech.contentType, 'Cache-Control': 'private, max-age=86400' },
        });
    } catch (error) {
        console.error('[brief] voice failed', error instanceof Error ? error.message : error);
        const status = error instanceof SpeechRequestError ? 502 : 500;
        return NextResponse.json({ error: 'Couldn’t read it aloud right now.' }, { status });
    }
}
