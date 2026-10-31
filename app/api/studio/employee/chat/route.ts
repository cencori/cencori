/**
 * The owner's conversation with one of their employees (lib/studio/owner-chat.ts),
 * one thread each. New messages are said through /api/agent (thread: true,
 * agentId), which keeps them. agent_id picks the employee; without it, the
 * main one. Every answer says whose thread it was (agent_id), so the app only
 * switches to a chosen employee once the server knows them.
 *   GET    ?project_id=&agent_id=           the latest messages, each with when it was sent
 *   PATCH  { project_id, agent_id?, message_id, action_id | note_id, state, result? }
 *          how a proposed action or a saved fact ended (confirmed, undone…),
 *          so it shows that way after the app reopens
 *   DELETE ?project_id=&agent_id=           clear that chat: the employee forgets the conversation
 *          (not what it was told for customers, which is in its knowledge)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getThread, patchMessage, publicThread, saveThread, studioStaff, type ThreadKey } from '@/lib/studio/owner-chat';
import type { createAdminClient as Admin } from '@/lib/supabaseAdmin';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

/** Whose thread: the employee asked for (it must be in the business), else the main one. Null when it isn't theirs. */
async function whose(db: ReturnType<typeof Admin>, projectId: string, agentId: unknown): Promise<{ key: ThreadKey | undefined; agentId: string | null } | null> {
    const staff = await studioStaff(db, projectId);
    if (agentId !== undefined && agentId !== null && agentId !== '') {
        if (!isId(agentId) || !staff.some((agent) => agent.id === agentId)) return null;
        return { key: { agentId, main: agentId === staff[0]?.id }, agentId };
    }
    return staff[0] ? { key: { agentId: staff[0].id, main: true }, agentId: staff[0].id } : { key: undefined, agentId: null };
}

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!isId(projectId)) return fail('Say which business.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const employee = await whose(db, projectId, req.nextUrl.searchParams.get('agent_id'));
    if (!employee) return fail('That employee isn\'t in this business.', 404);
    const thread = await getThread(db, projectId, access.userId, employee.key);
    return NextResponse.json({ ...publicThread(thread), agent_id: employee.agentId }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isId(body?.project_id) || typeof body?.message_id !== 'string' || typeof body.state !== 'string') return fail('Say which message and what happened.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const employee = await whose(db, body.project_id, body.agent_id);
    if (!employee) return fail('That employee isn\'t in this business.', 404);
    const thread = await getThread(db, body.project_id, access.userId, employee.key);
    const changed = patchMessage(thread, body.message_id, {
        actionId: typeof body.action_id === 'string' ? body.action_id : undefined,
        noteId: typeof body.note_id === 'string' ? body.note_id : undefined,
        state: body.state,
        result: typeof body.result === 'string' ? body.result : undefined,
    });
    if (!changed) return fail('That isn\'t in the conversation.', 404);
    await saveThread(db, thread);
    return NextResponse.json({ ok: true, agent_id: employee.agentId });
}

export async function DELETE(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!isId(projectId)) return fail('Say which business.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const employee = await whose(db, projectId, req.nextUrl.searchParams.get('agent_id'));
    if (!employee) return fail('That employee isn\'t in this business.', 404);
    const thread = await getThread(db, projectId, access.userId, employee.key);
    if (thread.id) await saveThread(db, { ...thread, settings: { ...thread.settings, messages: [], summary: null, summarized: 0 } });
    return NextResponse.json({ ok: true, agent_id: employee.agentId });
}
