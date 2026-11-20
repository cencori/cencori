import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isFounderEmail } from '@/lib/internal-admin-auth';
import { adminUsers } from '@/lib/auth/admin-users';
import { addCredits, getCreditsBalance } from '@/lib/credits';

/**
 * Credits given to an organization by Cencori, not bought. Founder only.
 *
 * The email and the organization are both required and must agree: the
 * account has to own the organization or be a member of it, so a mistyped
 * slug cannot land credits on a stranger's wallet. The grant is an
 * `adjustment` credit transaction carrying who issued it; it is not a
 * payment and does not enter the revenue ledger.
 */

export const runtime = 'nodejs';

const MAX_GRANT_USD = 1000;

export async function POST(request: Request) {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isFounderEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => null) as
        | { email?: unknown; organization?: unknown; amount?: unknown; note?: unknown }
        | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const organization = typeof body?.organization === 'string' ? body.organization.trim() : '';
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : '';

    if (!email || !organization) {
        return NextResponse.json({ error: 'An email and an organization are both required.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_GRANT_USD) {
        return NextResponse.json({ error: `The amount must be between $0.01 and $${MAX_GRANT_USD}.` }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: bySlug, error: orgError } = await admin
        .from('organizations')
        .select('id, name, slug, owner_id')
        .eq('slug', organization.toLowerCase())
        .limit(2);
    if (orgError) return NextResponse.json({ error: 'The organization could not be looked up.' }, { status: 500 });
    let orgs = bySlug ?? [];
    if (orgs.length === 0) {
        const { data: byName } = await admin
            .from('organizations')
            .select('id, name, slug, owner_id')
            .ilike('name', organization.replace(/[%_\\]/g, '\\$&'))
            .limit(5);
        orgs = byName ?? [];
    }
    if (orgs.length === 0) {
        return NextResponse.json({ error: `No organization has the slug or name "${organization}".` }, { status: 404 });
    }

    const { data: found } = await adminUsers.searchUsers(email, 20);
    const account = (found?.users ?? []).find((candidate) => candidate.email?.toLowerCase() === email);
    if (!account) return NextResponse.json({ error: `No account has the email ${email}.` }, { status: 404 });

    const { data: memberships } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', account.id)
        .in('organization_id', orgs.map((org) => org.id));
    const memberOf = new Set((memberships ?? []).map((row) => row.organization_id));
    const theirs = orgs.filter((org) => org.owner_id === account.id || memberOf.has(org.id));
    if (theirs.length === 0) {
        return NextResponse.json({ error: `${email} does not own and is not a member of "${organization}".` }, { status: 409 });
    }
    if (theirs.length > 1) {
        return NextResponse.json({
            error: `${email} belongs to more than one organization named "${organization}". Use the slug: ${theirs.map((org) => org.slug).join(', ')}.`,
        }, { status: 409 });
    }
    const org = theirs[0];

    const before = await getCreditsBalance(org.id);
    const granted = await addCredits(
        org.id,
        amount,
        'adjustment',
        note || 'Credits issued by Cencori',
        { reason: 'issued_credits', issued_by: user.email, issued_to: email },
    );
    if (!granted) return NextResponse.json({ error: 'The credits could not be added.' }, { status: 500 });

    return NextResponse.json({
        organization: { name: org.name, slug: org.slug },
        email,
        amount,
        balance_before: before,
        balance_after: await getCreditsBalance(org.id),
    });
}
