/**
 * /api/studio/events/banner
 *
 * An event's banner or flyer, shown at the top of its ticket page and as the
 * picture when its link is shared.
 *   POST    { project_id, event_id, data, mime_type }  base64, resized on the phone first
 *   DELETE  { project_id, event_id }                   remove it
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { ensureFileBucket, fileUrl, listFiles, putFile, removeFiles } from '@/lib/storage/files';
import { eventById, setEventBanner } from '@/lib/studio/events';

const BUCKET = 'event-banners' as const;
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

async function access(body: Record<string, unknown> | null) {
    if (!isId(body?.project_id) || !isId(body?.event_id)) return { error: fail('Say which event.') };
    const allowed = await requireProjectAccess(body.project_id);
    if (!allowed.ok) return { error: allowed.response };
    const db = createAdminClient();
    if (!await eventById(db, body.project_id, body.event_id)) return { error: fail('Event not found.', 404) };
    return { db, projectId: body.project_id, eventId: body.event_id };
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const checked = await access(body);
    if ('error' in checked) return checked.error;
    const mime = typeof body?.mime_type === 'string' ? body.mime_type : '';
    const data = typeof body?.data === 'string' ? body.data : '';
    if (!TYPES[mime] || !/^[A-Za-z0-9+/=]+$/.test(data)) return fail('Use a JPG, PNG or WebP picture.');
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > MAX_BYTES) return fail('That picture is too big (4 MB at most).');

    const bucketError = await ensureFileBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: Object.keys(TYPES) });
    if (bucketError) return fail('Couldn\'t save the picture right now.', 502);
    // One banner per event: the old one goes.
    const prefix = `${checked.projectId}/${checked.eventId}`;
    await removeFiles(BUCKET, await listFiles(BUCKET, prefix)).catch(() => undefined);
    const key = `${prefix}/${Date.now()}.${TYPES[mime]}`;
    const { error } = await putFile(BUCKET, key, bytes, mime);
    if (error) return fail('Couldn\'t save the picture right now.', 502);
    const event = await setEventBanner(checked.db, checked.projectId, checked.eventId, fileUrl(BUCKET, key));
    return NextResponse.json({ banner_url: event?.banner_url ?? null });
}

export async function DELETE(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const checked = await access(body);
    if ('error' in checked) return checked.error;
    await removeFiles(BUCKET, await listFiles(BUCKET, `${checked.projectId}/${checked.eventId}`)).catch(() => undefined);
    await setEventBanner(checked.db, checked.projectId, checked.eventId, null);
    return NextResponse.json({ banner_url: null });
}
