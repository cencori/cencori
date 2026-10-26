/**
 * /api/projects/:projectId/payments
 *
 * The project's payment provider account (Paystack, Flutterwave or Stripe),
 * which its agents take payments into.
 *   GET     the providers on offer, the connected one, and recent payments
 *   PUT     { provider, secret_key } connect (or switch) — the key is checked first
 *   DELETE  disconnect
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { connectPayments, disconnectPayments, getPaymentsConnection, publicPayments } from '@/lib/embedded/payments';
import { PAYMENT_PROVIDERS, UPCOMING_PAYMENT_PROVIDERS, isPaymentProvider } from '@/lib/integrations/payment-providers';

const PROVIDERS = [
    ...Object.values(PAYMENT_PROVIDERS).map((p) => ({ id: p.id, name: p.name, key_help: p.keyHelp, key_placeholder: p.keyPlaceholder, available: true })),
    ...UPCOMING_PAYMENT_PROVIDERS.map((p) => ({ id: p.id, name: p.name, key_help: '', key_placeholder: '', available: false })),
];

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
    const [connection, manage] = await Promise.all([getPaymentsConnection(db, projectId), canManage(db, access.organizationId, access.userId)]);
    return NextResponse.json({ providers: PROVIDERS, payments: publicPayments(connection), can_manage: manage }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can connect payments.', 403);
    const body = await req.json().catch(() => null) as { provider?: unknown; secret_key?: unknown } | null;
    if (!isPaymentProvider(body?.provider)) return fail('Choose Paystack, Flutterwave or Stripe.');
    if (typeof body?.secret_key !== 'string' || !body.secret_key.trim()) return fail(`Paste your ${PAYMENT_PROVIDERS[body.provider].name} secret key.`);
    const saved = await connectPayments(db, { projectId, organizationId: access.organizationId, provider: body.provider, secretKey: body.secret_key });
    if (!saved.ok) return fail(saved.message, saved.status);
    return NextResponse.json({ providers: PROVIDERS, payments: publicPayments(saved.connection), can_manage: true });
}

export async function DELETE(_req: NextRequest, ctx: Context) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can disconnect payments.', 403);
    await disconnectPayments(db, projectId);
    return NextResponse.json({ providers: PROVIDERS, payments: null, can_manage: true });
}
