import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

/**
 * GET /api/github/user-installations?organizationId=...
 *
 * Returns all GitHub App installations accessible to the current user
 * that are NOT already linked to the given organization.
 *
 * Sources checked (mirrors the Scan import logic):
 *  1. Installations linked to any org the user owns
 *  2. Installations linked to any org the user is a member of
 *  3. Installations recorded under the user's GitHub account login
 *  4. Installations explicitly recorded as installed by this user (installed_by_user_id)
 */
export async function GET(req: NextRequest) {
    const supabase = await createServerClient();

    const { searchParams } = new URL(req.url);
    const currentOrgId = searchParams.get('organizationId');

    if (!currentOrgId) {
        return NextResponse.json({ error: 'Missing organizationId parameter' }, { status: 400 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Verify the user has access to the requested org
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, owner_id')
            .eq('id', currentOrgId)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Allow org owners AND members
        if (org.owner_id !== user.id) {
            const { data: membership } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', currentOrgId)
                .eq('user_id', user.id)
                .single();

            if (!membership) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        const supabaseAdmin = createAdminClient();

        // ── Already linked to this org ──────────────────────────────────────────
        const { data: currentOrgLinks } = await supabaseAdmin
            .from('organization_github_installations')
            .select('installation_id')
            .eq('organization_id', currentOrgId);

        const alreadyLinkedIds = new Set(
            (currentOrgLinks || []).map(l => l.installation_id)
        );

        // ── Collect all installation IDs reachable by this user ─────────────────
        const reachableIds: Set<number> = new Set();

        // 1 & 2: orgs the user owns or is a member of
        const [{ data: ownedOrgs }, { data: memberships }] = await Promise.all([
            supabaseAdmin.from('organizations').select('id').eq('owner_id', user.id),
            supabaseAdmin.from('organization_members').select('organization_id').eq('user_id', user.id),
        ]);

        const allOrgIds = new Set<string>();
        (ownedOrgs || []).forEach(o => allOrgIds.add(o.id));
        (memberships || []).forEach(m => { if (m.organization_id) allOrgIds.add(m.organization_id); });

        if (allOrgIds.size > 0) {
            const { data: orgLinks } = await supabaseAdmin
                .from('organization_github_installations')
                .select('installation_id')
                .in('organization_id', Array.from(allOrgIds));
            (orgLinks || []).forEach(l => reachableIds.add(l.installation_id));
        }

        // 3: installations whose GitHub account matches the user's GitHub username
        const githubIdentity = user.identities?.find(i => i.provider === 'github');
        const githubUsername =
            githubIdentity?.identity_data?.user_name ||
            githubIdentity?.identity_data?.preferred_username ||
            null;

        if (githubUsername) {
            const { data: byLogin } = await supabaseAdmin
                .from('github_app_installations')
                .select('installation_id')
                .ilike('github_account_login', githubUsername);
            (byLogin || []).forEach(i => reachableIds.add(i.installation_id));
        }

        // 4: installations explicitly recorded as installed by this user
        const { data: byUser } = await supabaseAdmin
            .from('github_app_installations')
            .select('installation_id')
            .eq('installed_by_user_id', user.id);
        (byUser || []).forEach(i => reachableIds.add(i.installation_id));

        // ── Filter out what's already linked ────────────────────────────────────
        const availableIds = Array.from(reachableIds).filter(id => !alreadyLinkedIds.has(id));

        if (availableIds.length === 0) {
            return NextResponse.json({ installations: [] });
        }

        // ── Fetch installation details ───────────────────────────────────────────
        const { data: installations, error: installationsError } = await supabaseAdmin
            .from('github_app_installations')
            .select('installation_id, github_account_type, github_account_login, github_account_name')
            .in('installation_id', availableIds);

        if (installationsError) {
            console.error('[User Installations] Error fetching installation details:', installationsError);
            return NextResponse.json({ error: 'Failed to fetch installation details' }, { status: 500 });
        }

        console.log(
            `[User Installations] Found ${installations?.length ?? 0} linkable installations for user ${user.id} → org ${currentOrgId}`
        );

        return NextResponse.json({ installations: installations || [] });
    } catch (error) {
        console.error('[User Installations] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
