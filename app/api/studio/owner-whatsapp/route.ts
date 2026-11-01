/**
 * Texting your employee on WhatsApp (lib/studio/owner-whatsapp.ts).
 *
 * GET    /api/studio/owner-whatsapp?project_id=&agent_id=   Whether you're linked, and on which number.
 * POST   /api/studio/owner-whatsapp  { project_id, agent_id, phone? }
 *        With phone: the employee texts that number a code on WhatsApp, to
 *        type in the app (PATCH). Without: the one-tap WhatsApp link that sends
 *        "Link <code>" to the employee's number (also the fallback while the
 *        code message isn't approved yet).
 * PATCH  /api/studio/owner-whatsapp  { project_id, agent_id, code }   The code from WhatsApp.
 * DELETE /api/studio/owner-whatsapp  { project_id, agent_id }   Stop.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { confirmOwnerCode, ownerLinkStatus, startOwnerLink, textOwnerCode, unlinkOwner } from '@/lib/studio/owner-whatsapp';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

async function employeeOf(projectId: string, agentId: string) {
    const { data } = await createAdminClient().from('agents').select('id').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    return !!data;
}

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    const agentId = req.nextUrl.searchParams.get('agent_id');
    if (!isId(projectId) || !isId(agentId)) return fail('Say which employee.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    return NextResponse.json(await ownerLinkStatus(createAdminClient(), projectId, access.userId, agentId), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; agent_id?: unknown; phone?: unknown } | null;
    if (!isId(body?.project_id) || !isId(body?.agent_id)) return fail('Say which employee.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    // Owner mode sees the money and acts for the business: owners and admins only.
    if (!['owner', 'admin'].includes(access.role)) return fail('Only owners and admins can text their employee on WhatsApp.', 403);
    if (!await employeeOf(body.project_id, body.agent_id)) return fail('That employee isn\'t in this business.', 404);
    if (typeof body.phone === 'string' && body.phone.trim()) {
        const texted = await textOwnerCode(createAdminClient(), { projectId: body.project_id, userId: access.userId, agentId: body.agent_id, phone: body.phone });
        if (!texted.ok) return fail(texted.message, 409);
        return NextResponse.json(texted);
    }
    const started = await startOwnerLink(createAdminClient(), { projectId: body.project_id, userId: access.userId, agentId: body.agent_id });
    if (!started.ok) return fail(started.message, 409);
    return NextResponse.json(started);
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; agent_id?: unknown; code?: unknown } | null;
    if (!isId(body?.project_id) || !isId(body?.agent_id)) return fail('Say which employee.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    if (!['owner', 'admin'].includes(access.role)) return fail('Only owners and admins can text their employee on WhatsApp.', 403);
    const confirmed = await confirmOwnerCode(createAdminClient(), { projectId: body.project_id, userId: access.userId, agentId: body.agent_id, code: typeof body.code === 'string' ? body.code : '' });
    if (!confirmed.ok) return NextResponse.json({ error: confirmed.message, ...(confirmed.wrong ? { reason: 'wrong_code' } : {}) }, { status: 400 });
    return NextResponse.json({ linked: true, phone: confirmed.phone });
}

export async function DELETE(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; agent_id?: unknown } | null;
    if (!isId(body?.project_id) || !isId(body?.agent_id)) return fail('Say which employee.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    await unlinkOwner(createAdminClient(), body.project_id, access.userId, body.agent_id);
    return NextResponse.json({ linked: false });
}
