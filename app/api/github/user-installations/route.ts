import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getOrganizationLinkedInstallationIds, getReachableGithubInstallationIds } from '@/lib/github-installations';

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
        // Verify organization exists and user has access.
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, owner_id')
            .eq('id', currentOrgId)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        let hasOrgAccess = org.owner_id === user.id;
        if (!hasOrgAccess) {
            const { data: membership, error: membershipError } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', currentOrgId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (membershipError) {
                console.error('[User Installations] Error checking organization membership:', membershipError);
                return NextResponse.json({ error: 'Failed to verify organization access' }, { status: 500 });
            }

            hasOrgAccess = !!membership;
        }

        if (!hasOrgAccess) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabaseAdmin = createAdminClient();
        const [currentOrgLinkedIds, reachableIds] = await Promise.all([
            getOrganizationLinkedInstallationIds(currentOrgId),
            getReachableGithubInstallationIds(user),
        ]);

        // ── Filter out what's already linked ────────────────────────────────────
        const linkedIdSet = new Set(currentOrgLinkedIds);
        const availableIds = Array.from(reachableIds).filter((id) => !linkedIdSet.has(id));

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

        // Deduplicate by github_account_login — keep highest installation_id per account
        const seenLogins = new Map<string, typeof installations[0]>();
        for (const inst of (installations || [])) {
            const login = inst.github_account_login?.toLowerCase() ?? String(inst.installation_id);
            const existing = seenLogins.get(login);
            if (!existing || inst.installation_id > existing.installation_id) {
                seenLogins.set(login, inst);
            }
        }
        const deduplicated = Array.from(seenLogins.values());

        console.log(
            `[User Installations] Found ${deduplicated.length} linkable installations (${installations?.length ?? 0} before dedup) for user ${user.id} → org ${currentOrgId}`
        );

        return NextResponse.json({ installations: deduplicated });
    } catch (error) {
        console.error('[User Installations] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
