import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';
import { generateInvoices } from '@/lib/invoice-generation';

async function getProjectWithAdminAccess(projectId: string) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Unauthorized', status: 401 };

    const admin = createAdminClient();
    const { data: project } = await admin
        .from('projects')
        .select('id, organization_id, organizations!inner(owner_id)')
        .eq('id', projectId)
        .single();

    if (!project) return { error: 'Project not found', status: 404 };

    const ownerId = (project.organizations as { owner_id?: string } | null)?.owner_id || null;
    const isOwner = ownerId === user.id;

    if (!isOwner) {
        const { data: membership } = await admin
            .from('organization_members')
            .select('role')
            .eq('organization_id', project.organization_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!membership || !['admin', 'owner'].includes(membership.role)) {
            return { error: 'Forbidden - Admin access required', status: 403 };
        }
    }

    return { project, user, admin };
}

// GET — list invoices for a project
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const result = await getProjectWithAdminAccess(projectId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const { admin } = result;
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '25', 10)));
        const status = searchParams.get('status') || null;
        const endUserId = searchParams.get('end_user_id') || null;
        const offset = (page - 1) * perPage;

        let query = admin
            .from('end_user_invoices')
            .select('*, end_users(external_id, display_name, email)', { count: 'exact' })
            .eq('project_id', projectId);

        if (status) {
            query = query.eq('status', status);
        }
        if (endUserId) {
            query = query.eq('end_user_id', endUserId);
        }

        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + perPage - 1);

        const { data: invoices, error, count } = await query;

        if (error) {
            console.error('[Invoices] GET error:', error);
            return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
        }

        return NextResponse.json({
            invoices: (invoices || []).map(inv => {
                const endUser = inv.end_users as { external_id: string; display_name: string | null; email: string | null } | null;
                return {
                    id: inv.id,
                    end_user_id: inv.end_user_id,
                    end_user_external_id: endUser?.external_id ?? null,
                    end_user_name: endUser?.display_name ?? endUser?.external_id ?? null,
                    end_user_email: endUser?.email ?? null,
                    stripe_invoice_id: inv.stripe_invoice_id,
                    period_start: inv.period_start,
                    period_end: inv.period_end,
                    total_requests: inv.total_requests,
                    total_tokens: inv.total_tokens,
                    subtotal_usd: inv.subtotal_usd,
                    markup_usd: inv.markup_usd,
                    total_usd: inv.total_usd,
                    status: inv.status,
                    sent_at: inv.sent_at,
                    paid_at: inv.paid_at,
                    line_items: inv.line_items,
                    created_at: inv.created_at,
                };
            }),
            pagination: {
                page,
                per_page: perPage,
                total: count || 0,
                total_pages: Math.ceil((count || 0) / perPage),
            },
        });
    } catch (error) {
        console.error('[Invoices] GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST — generate invoices for a billing period
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const result = await getProjectWithAdminAccess(projectId);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const { project, user } = result;
        const body = await req.json();
        const { period_start, period_end, end_user_ids, send_via_stripe } = body;

        if (!period_start || !period_end) {
            return NextResponse.json(
                { error: 'period_start and period_end are required (YYYY-MM-DD)' },
                { status: 400 }
            );
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(period_start) || !dateRegex.test(period_end)) {
            return NextResponse.json(
                { error: 'Dates must be in YYYY-MM-DD format' },
                { status: 400 }
            );
        }

        if (new Date(period_start) >= new Date(period_end)) {
            return NextResponse.json(
                { error: 'period_start must be before period_end' },
                { status: 400 }
            );
        }

        const invoiceResult = await generateInvoices({
            projectId,
            organizationId: project.organization_id,
            periodStart: period_start,
            periodEnd: period_end,
            endUserIds: end_user_ids || undefined,
            sendViaStripe: send_via_stripe ?? false,
            actorId: user.id,
            actorEmail: user.email,
        });

        return NextResponse.json({
            generated: invoiceResult.generated.length,
            skipped: invoiceResult.skipped.length,
            errors: invoiceResult.errors.length,
            invoices: invoiceResult.generated,
            skipped_details: invoiceResult.skipped,
            ...(invoiceResult.errors.length > 0 ? { error_details: invoiceResult.errors } : {}),
        }, { status: 201 });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Internal server error';
        console.error('[Invoices] POST error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
