/**
 * PUT    /api/studio/transfers  { project_id, bank, account_number, account_name }
 *        The account customers transfer to. Saving it turns "pay by transfer"
 *        on: the assistant gives customers these details when they're ready to pay.
 * DELETE /api/studio/transfers?project_id=
 *        Stop offering transfers (what came in stays in Money).
 * POST   /api/studio/transfers  { project_id, reference, action: 'confirm' | 'not_received' }
 *        The owner checked their account: the money arrived (it counts, the
 *        order is paid, a WhatsApp customer is thanked), or it hasn't yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { cleanBankAccount, confirmTransfer, rejectTransfer, removeBankAccount, saveBankAccount } from '@/lib/embedded/transfers';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

async function ownerOrAdmin(projectId: string) {
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access;
    if (!['owner', 'admin'].includes(access.role)) return { ok: false as const, response: fail('Only owners and admins can change how customers pay.', 403) };
    return access;
}

export async function PUT(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const access = await ownerOrAdmin(body.project_id);
    if (!access.ok) return access.response;
    const cleaned = cleanBankAccount(body);
    if (!cleaned.ok) return fail(cleaned.message);
    const saved = await saveBankAccount(createAdminClient(), body.project_id, cleaned.account);
    if (!saved) return fail('Couldn\'t save the account. Try again.', 502);
    return NextResponse.json({ bank_account: saved.metadata.account });
}

export async function DELETE(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!isId(projectId)) return fail('Say which project.');
    const access = await ownerOrAdmin(projectId);
    if (!access.ok) return access.response;
    await removeBankAccount(createAdminClient(), projectId);
    return NextResponse.json({ bank_account: null });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; reference?: unknown; action?: unknown } | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    if (typeof body.reference !== 'string' || !/^TRF-[0-9A-F]{6}$/.test(body.reference)) return fail('Say which transfer.');
    const db = createAdminClient();
    const result = body.action === 'confirm'
        ? await confirmTransfer(db, body.project_id, body.reference)
        : body.action === 'not_received'
            ? await rejectTransfer(db, body.project_id, body.reference)
            : undefined;
    if (result === undefined) return fail('Unknown change.');
    if (!result) return fail('That transfer isn\'t there any more. Refresh and try again.', 404);
    return NextResponse.json({ transfer: { reference: result.reference, status: result.status } });
}
