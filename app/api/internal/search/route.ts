import { getAuthUser } from '@/lib/auth/get-auth-user';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkInternalAccess } from '@/lib/internal-access';
import { adminUsers } from '@/lib/auth/admin-users';

/**
 * Search for the admin console (components/internal/admin-search.tsx): users,
 * organizations, payments, sent emails and feedback matching one query.
 * Each source is searched on its own, so one failing returns empty rather
 * than failing the rest.
 */

export const runtime = 'nodejs';

const LIMIT = 6;

export interface AdminSearchResults {
    users: { id: string; email: string; name: string | null; created_at: string | null }[];
    organizations: { id: string; name: string; slug: string; subscription_tier: string | null; billing_email: string | null }[];
    payments: {
        id: string;
        provider: string;
        provider_payment_id: string;
        product_type: string;
        amount: number;
        currency: string;
        amount_usd: number;
        customer_email: string | null;
        organization_name: string | null;
        paid_at: string;
    }[];
    emails: { id: string; subject: string; single_recipient: string | null; audience_type: string; status: string; created_at: string }[];
    feedback: { id: string; content: string; type: string; status: string; created_at: string }[];
}

async function settle<T>(label: string, run: () => Promise<T>, empty: T): Promise<T> {
    try {
        return await run();
    } catch (error) {
        console.error(`[Admin search] ${label} failed`, error);
        return empty;
    }
}

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await checkInternalAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100);
    // PostgREST's or() filter splits on commas and parentheses; ilike treats % and _ as wildcards.
    const q = raw.replace(/[,()%_*\\"']/g, ' ').replace(/\s+/g, ' ').trim();
    const empty: AdminSearchResults = { users: [], organizations: [], payments: [], emails: [], feedback: [] };
    if (q.length < 2) return NextResponse.json(empty);

    const admin = createAdminClient();
    const like = `%${q}%`;

    const [users, organizations, emails, feedback] = await Promise.all([
        settle('users', async () => {
            const { data, error } = await adminUsers.searchUsers(q, LIMIT);
            if (error) throw new Error(error.message);
            return data.users.map((u) => ({
                id: u.id,
                email: u.email ?? '',
                name: (u.user_metadata?.full_name || u.user_metadata?.name || null) as string | null,
                created_at: u.created_at ?? null,
            }));
        }, empty.users),
        settle('organizations', async () => {
            const { data, error } = await admin
                .from('organizations')
                .select('id, name, slug, subscription_tier, billing_email')
                .or(`name.ilike.${like},slug.ilike.${like},billing_email.ilike.${like}`)
                .limit(LIMIT);
            if (error) throw error;
            return (data ?? []) as AdminSearchResults['organizations'];
        }, empty.organizations),
        settle('emails', async () => {
            const { data, error } = await admin
                .from('email_sends')
                .select('id, subject, single_recipient, audience_type, status, created_at')
                .or(`subject.ilike.${like},single_recipient.ilike.${like}`)
                .order('created_at', { ascending: false })
                .limit(LIMIT);
            if (error) throw error;
            return (data ?? []) as AdminSearchResults['emails'];
        }, empty.emails),
        settle('feedback', async () => {
            const { data, error } = await admin
                .from('feedback')
                .select('id, content, type, status, created_at')
                .ilike('content', like)
                .order('created_at', { ascending: false })
                .limit(LIMIT);
            if (error) throw error;
            return (data ?? []) as AdminSearchResults['feedback'];
        }, empty.feedback),
    ]);

    // Payments match on their own fields, or belong to a matching organization.
    const payments = await settle('payments', async () => {
        const orgIds = organizations.map((org) => org.id);
        const filters = [
            `customer_email.ilike.${like}`,
            `provider_payment_id.ilike.${like}`,
            `product_type.ilike.${like}`,
            ...(orgIds.length ? [`organization_id.in.(${orgIds.join(',')})`] : []),
        ];
        const { data, error } = await admin
            .from('payments')
            .select('id, provider, provider_payment_id, product_type, amount, currency, amount_usd, customer_email, organization_id, paid_at')
            .or(filters.join(','))
            .order('paid_at', { ascending: false })
            .limit(LIMIT);
        if (error) throw error;
        const rows = data ?? [];
        const ids = [...new Set(rows.map((row) => row.organization_id).filter(Boolean))] as string[];
        const names = new Map<string, string>();
        if (ids.length) {
            const { data: orgs } = await admin.from('organizations').select('id, name').in('id', ids);
            for (const org of orgs ?? []) names.set(org.id, org.name);
        }
        return rows.map((row) => ({
            id: row.id,
            provider: row.provider,
            provider_payment_id: row.provider_payment_id,
            product_type: row.product_type,
            amount: Number(row.amount),
            currency: row.currency,
            amount_usd: Number(row.amount_usd),
            customer_email: row.customer_email,
            organization_name: row.organization_id ? names.get(row.organization_id) ?? null : null,
            paid_at: row.paid_at,
        }));
    }, empty.payments);

    const results: AdminSearchResults = { users, organizations, payments, emails, feedback };
    return NextResponse.json(results);
}
