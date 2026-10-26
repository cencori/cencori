/**
 * /api/projects/:projectId/catalog
 *
 * The project's product catalog, which its agents sell from, and the orders
 * they've taken.
 *   GET     the products and the latest orders
 *   PUT     { products, currency? } replace the products (creates the catalog)
 *   PATCH   { order_id, status: 'done' | 'cancelled' } update an order
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getCatalog, publicCatalog, saveProducts, setOrderStatus } from '@/lib/embedded/catalog';

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function canManage(db: Admin, organizationId: string, userId: string) {
    const { data: organization } = await db.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle();
    if (organization?.owner_id === userId) return true;
    const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    return ['owner', 'admin'].includes((membership?.role as string) ?? '');
}

export async function GET(_req: NextRequest, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const [catalog, manage] = await Promise.all([getCatalog(db, projectId), canManage(db, access.organizationId, access.userId)]);
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
    const saved = await saveProducts(db, projectId, { products: body.products, currency: body.currency });
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
