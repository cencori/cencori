/**
 * POST   /api/studio/business  { name }
 *        A new business for the signed-in person, set up like signup's business
 *        track: a business account on the free trial (with its trial credit),
 *        its project, and them as owner. Up to MAX_BUSINESSES each.
 * PATCH  /api/studio/business  { organization_id, name }
 *        Rename a business (the organization): owners and admins, 1–48
 *        characters. The slug and everything else stay as they are.
 * DELETE /api/studio/business  { organization_id, confirm }
 *        Delete a business and everything in it: the owner only, with its exact
 *        name typed to confirm. Business accounts only: a developer organization
 *        (API keys, logs, console projects) is deleted from the console, never here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { addCredits } from '@/lib/credits';
import { BUSINESS_TRIAL_CREDITS_USD, startBusinessTrial } from '@/lib/business/plans';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** How many business accounts one person may own: each comes with a free trial. */
const MAX_BUSINESSES = 5;

function cleanName(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

const randomSlug = () => Array.from(randomBytes(20), (byte) => 'abcdefghijklmnopqrstuvwxyz0123456789'[byte % 36]).join('');

export async function POST(req: NextRequest) {
    const { data: { user } } = await getAuthUser(await createServerClient());
    if (!user) return fail('Unauthorized', 401);
    const body = await req.json().catch(() => null) as { name?: unknown } | null;
    const name = cleanName(body?.name);
    if (!name) return fail('Give your business a name.');
    if (name.length > 48) return fail('Keep it to 48 characters or fewer.');

    const db = createAdminClient();
    const { count } = await db.from('organizations').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('account_type', 'business');
    if ((count ?? 0) >= MAX_BUSINESSES) return fail(`You can have up to ${MAX_BUSINESSES} businesses. Delete one you don't use to add another.`, 409);

    const { data: organization, error } = await db.from('organizations').insert({
        name, slug: randomSlug(), subscription_tier: 'free', subscription_status: 'active', monthly_requests_used: 0, owner_id: user.id,
    }).select('id').single();
    if (error || !organization) return fail('Couldn\'t create the business. Try again.', 502);
    const organizationId = organization.id as string;
    const undo = () => db.from('organizations').delete().eq('id', organizationId);

    const { error: memberError } = await db.from('organization_members').insert({ organization_id: organizationId, user_id: user.id, role: 'owner' });
    if (memberError) {
        await undo();
        return fail('Couldn\'t create the business. Try again.', 502);
    }
    try {
        if (await startBusinessTrial(db as never, organizationId)) {
            await addCredits(organizationId, BUSINESS_TRIAL_CREDITS_USD, 'adjustment', 'Free trial credit', { reason: 'business_trial_welcome' }).catch(() => undefined);
        }
    } catch {
        await undo();
        return fail('Couldn\'t start the free trial. Try again.', 502);
    }
    const { error: projectError } = await db.from('projects').insert({ name, slug: 'main', organization_id: organizationId, visibility: 'private', region: 'europe' });
    if (projectError) {
        await undo();
        return fail('Couldn\'t create the business. Try again.', 502);
    }
    return NextResponse.json({ organization_id: organizationId, name }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
    const { data: { user } } = await getAuthUser(await createServerClient());
    if (!user) return fail('Unauthorized', 401);
    const body = await req.json().catch(() => null) as { organization_id?: unknown; name?: unknown } | null;
    const organizationId = typeof body?.organization_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.organization_id) ? body.organization_id : null;
    if (!organizationId) return fail('Say which business.');
    const name = typeof body?.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
    if (!name) return fail('Give your business a name.');
    if (name.length > 48) return fail('Keep it to 48 characters or fewer.');

    const db = createAdminClient();
    const { data: organization } = await db.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle();
    if (!organization) return fail('Business not found.', 404);
    if (organization.owner_id !== user.id) {
        const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
        const role = membership?.role as string | undefined;
        if (!membership) return fail('Business not found.', 404);
        if (role !== 'owner' && role !== 'admin') return fail('Only owners and admins can rename the business.', 403);
    }
    const { error } = await db.from('organizations').update({ name }).eq('id', organizationId);
    if (error) return fail('Couldn\'t rename it. Try again.', 502);
    return NextResponse.json({ name });
}

export async function DELETE(req: NextRequest) {
    const { data: { user } } = await getAuthUser(await createServerClient());
    if (!user) return fail('Unauthorized', 401);
    const body = await req.json().catch(() => null) as { organization_id?: unknown; confirm?: unknown } | null;
    const organizationId = typeof body?.organization_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.organization_id) ? body.organization_id : null;
    if (!organizationId) return fail('Say which business.');
    const db = createAdminClient();
    const { data: organization } = await db.from('organizations').select('name, owner_id, account_type').eq('id', organizationId).maybeSingle();
    if (!organization) return fail('Business not found.', 404);
    if (organization.owner_id !== user.id) return fail('Only the owner can delete a business.', 403);
    if (organization.account_type !== 'business') return fail('This is a developer organization. Delete it from the console.', 403);
    if (typeof body?.confirm !== 'string' || body.confirm.trim() !== organization.name) return fail('Type the business\'s name exactly to confirm.');
    const { error } = await db.from('organizations').delete().eq('id', organizationId);
    if (error) {
        console.error('[studio/business] delete failed', organizationId, error.message);
        return fail('Couldn\'t delete it. Try again.', 502);
    }
    return NextResponse.json({ deleted: true });
}
