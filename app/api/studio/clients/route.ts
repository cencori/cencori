/**
 * GET    /api/studio/clients?project_id=&phone=       A client's card: visits, what's coming up, orders, spend, notes.
 * POST   /api/studio/clients  { project_id, phone, note }       Keep a note about them.
 * DELETE /api/studio/clients  { project_id, phone, note_id }    Remove a note.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { addClientNote, clientCard, removeClientNote } from '@/lib/studio/clients';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    const phone = req.nextUrl.searchParams.get('phone') ?? '';
    if (!isId(projectId)) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const card = await clientCard(createAdminClient(), projectId, phone);
    if (!card) return fail('No history with that number yet.', 404);
    return NextResponse.json({ client: card }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; phone?: unknown; note?: unknown } | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    const saved = await addClientNote(createAdminClient(), body.project_id, String(body.phone ?? ''), String(body.note ?? ''), 'owner');
    if (!saved.ok) return fail(saved.message);
    return NextResponse.json({ note: saved.note });
}

export async function DELETE(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; phone?: unknown; note_id?: unknown } | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    const removed = await removeClientNote(createAdminClient(), body.project_id, String(body.phone ?? ''), String(body.note_id ?? ''));
    if (!removed) return fail('That note isn\'t there any more.', 404);
    return NextResponse.json({ removed: true });
}
