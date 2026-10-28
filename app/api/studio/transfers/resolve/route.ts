/**
 * GET /api/studio/transfers/resolve?project_id=&bank=&account_number=
 *
 * The name on an account, from its bank, for the "Add your account" sheet.
 * Owners and admins only, a few a minute each (every check is a real
 * enquiry to the banking network).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { resolveAccountName } from '@/lib/payouts/name-enquiry';

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const projectId = params.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const { checkCustomRateLimit } = await import('@/lib/rate-limit');
    const limited = await checkCustomRateLimit(`name_enquiry:${access.userId}`, 15, 600);
    if (!limited.allowed) return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 429 });
    const result = await resolveAccountName(params.get('bank') ?? '', (params.get('account_number') ?? '').replace(/\D/g, ''));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
