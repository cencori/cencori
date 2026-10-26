/**
 * GET /api/billing/invoices/:chargeId?org=<slug>
 *
 * The PDF invoice for one Bachs card payment. Any member of the organization
 * can download it; the charge must be a top-up recorded against that org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import {
    buildBachsInvoice,
    getBachsTopup,
    renderBachsInvoicePdf,
    type InvoiceOrg,
} from '@/lib/billing/bachs-invoices';

export const runtime = 'nodejs';

const ORG_COLUMNS = 'id, slug, name, owner_id, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip, billing_country, billing_tax_id';

export async function GET(req: NextRequest, ctx: { params: Promise<{ chargeId: string }> }) {
    const { chargeId } = await ctx.params;
    const orgSlug = req.nextUrl.searchParams.get('org');
    if (!orgSlug || !/^ch_[A-Za-z0-9]+$/.test(chargeId)) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read through the user's session so RLS hides orgs they don't belong to.
    const { data: org } = await supabase
        .from('organizations')
        .select(ORG_COLUMNS)
        .eq('slug', orgSlug)
        .maybeSingle();
    if (!org) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (org.owner_id !== user.id) {
        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', org.id)
            .eq('user_id', user.id)
            .maybeSingle();
        if (!membership) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }
    }

    const record = await getBachsTopup(createAdminClient(), org.id, chargeId);
    if (!record) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = await buildBachsInvoice(org as InvoiceOrg, record);
    const pdf = renderBachsInvoicePdf(invoice);

    return new Response(pdf, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Cencori-Invoice-${invoice.number}.pdf"`,
            'Cache-Control': 'private, no-store',
        },
    });
}
