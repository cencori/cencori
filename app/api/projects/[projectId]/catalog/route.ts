/**
 * /api/projects/:projectId/catalog
 *
 * An agent's product catalog, which it sells from, and the orders it has
 * taken. Each agent has its own: `?agent_id=` says which (the project's first
 * agent without it, which Studio acts for).
 *   GET     the products and the latest orders
 *   PUT     { products, currency? } replace the products (creates the catalog)
 *   PATCH   { order_id, status: 'done' | 'cancelled' } update an order
 *   DELETE  delete the agent's catalog (refused while orders are open)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getCatalog, publicCatalog, removeCatalog, saveProducts, setOrderStatus } from '@/lib/embedded/catalog';
import { primaryAgentId } from '@/lib/embedded/agent-owned';

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/**
 * The agent the request is for: `?agent_id=`, checked against the project.
 * Without one it's the project's first agent, which Studio acts for.
 */
async function agentOf(db: Admin, req: NextRequest, projectId: string): Promise<{ ok: true; agentId: string } | { ok: false; response: NextResponse }> {
    const asked = req.nextUrl.searchParams.get('agent_id');
    if (!asked) {
        const first = await primaryAgentId(db, projectId);
        return first ? { ok: true, agentId: first } : { ok: false, response: fail('Make an agent first.', 404) };
    }
    const { data } = /^[0-9a-f-]{36}$/i.test(asked) ? await db.from('agents').select('id').eq('project_id', projectId).eq('id', asked).maybeSingle() : { data: null };
    return data ? { ok: true, agentId: data.id as string } : { ok: false, response: fail('That agent wasn\'t found.', 404) };
}

async function canManage(db: Admin, organizationId: string, userId: string) {
    const { data: organization } = await db.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle();
    if (organization?.owner_id === userId) return true;
    const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    return ['owner', 'admin'].includes((membership?.role as string) ?? '');
}

export async function GET(req: NextRequest, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const agent = await agentOf(db, req, projectId);
    // A project with no agent yet has no catalog either.
    if (!agent.ok) return req.nextUrl.searchParams.get('agent_id') ? agent.response : NextResponse.json({ catalog: null, can_manage: await canManage(db, access.organizationId, access.userId) }, { headers: { 'Cache-Control': 'no-store' } });
    const [catalog, manage] = await Promise.all([getCatalog(db, projectId, agent.agentId), canManage(db, access.organizationId, access.userId)]);
    return NextResponse.json({ catalog: publicCatalog(catalog), can_manage: manage }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can change the products.', 403);
    const body = await req.json().catch(() => null) as { products?: unknown; currency?: unknown } | null;
    if (!body) return fail('Send the products.');
    const agent = await agentOf(db, req, projectId);
    if (!agent.ok) return agent.response;
    const saved = await saveProducts(db, projectId, agent.agentId, { products: body.products, currency: body.currency });
    if (!saved.ok) return fail(saved.message, saved.status);
    return NextResponse.json({ catalog: publicCatalog(saved.catalog), can_manage: true });
}

export async function PATCH(req: NextRequest, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can update orders.', 403);
    const body = await req.json().catch(() => null) as { order_id?: unknown; status?: unknown } | null;
    if (typeof body?.order_id !== 'string' || (body.status !== 'done' && body.status !== 'cancelled')) return fail('Send order_id and a status of done or cancelled.');
    const catalog = await setOrderStatus(db, projectId, body.order_id, body.status);
    if (!catalog) return fail('That order wasn\'t found.', 404);
    return NextResponse.json({ catalog: publicCatalog(catalog), can_manage: true });
}

export async function DELETE(req: NextRequest, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can delete the products.', 403);
    const agent = await agentOf(db, req, projectId);
    if (!agent.ok) return agent.response;
    const removed = await removeCatalog(db, projectId, agent.agentId);
    if (!removed.ok) return fail(removed.message, removed.status);
    return NextResponse.json({ catalog: null, can_manage: true });
}
