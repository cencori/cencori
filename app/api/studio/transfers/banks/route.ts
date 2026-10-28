/**
 * GET /api/studio/transfers/banks?project_id=
 *
 * Nigerian banks and apps (OPay, PalmPay, Moniepoint…), for the bank field's
 * suggestions as the owner types. The server keeps the list a day; responses
 * aren't cached by the browser, so a failed load is never kept.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { bankNames } from '@/lib/payouts/name-enquiry';

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const banks = await bankNames();
    if (!banks.length) console.error('[transfers/banks] the bank list came back empty (Paystack key or network)');
    return NextResponse.json({ banks }, { headers: { 'Cache-Control': 'no-store' } });
}
