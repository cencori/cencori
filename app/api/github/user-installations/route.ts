import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

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
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, owner_id')
            .eq('id', currentOrgId)
            .single();

        if (orgError || !org || org.owner_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabaseAdmin = createAdminClient();

        console.log('[User Installations] Current org ID:', currentOrgId);
        console.log('[User Installations] User ID:', user.id);
        const { data: currentOrgLinks, error: currentLinksError } = await supabaseAdmin
            .from('organization_github_installations')
            .select('installation_id')
            .eq('organization_id', currentOrgId);

        if (currentLinksError) {
            console.error('[User Installations] Error fetching current org links:', currentLinksError);
            return NextResponse.json({ error: 'Failed to fetch current installations' }, { status: 500 });
        }

        const currentOrgInstallationIds = currentOrgLinks?.map(link => link.installation_id) || [];
        console.log('[User Installations] Current org already has these installations:', currentOrgInstallationIds);

        const { data: userOrgs, error: userOrgsError } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id);

        if (userOrgsError || !userOrgs || userOrgs.length === 0) {
            console.log('[User Installations] User has no organizations');
            return NextResponse.json({ installations: [] });
        }

        const userOrgIds = userOrgs.map(o => o.id);
        console.log('[User Installations] User owns', userOrgIds.length, 'organizations');

        const { data: allUserLinks, error: allLinksError } = await supabaseAdmin
            .from('organization_github_installations')
            .select('installation_id')
            .in('organization_id', userOrgIds);

        if (allLinksError) {
            console.error('[User Installations] Error fetching user installations:', allLinksError);
            return NextResponse.json({ error: 'Failed to fetch installations' }, { status: 500 });
        }

        if (!allUserLinks || allUserLinks.length === 0) {
            console.log('[User Installations] User has no installations linked to any org');
            return NextResponse.json({ installations: [] });
        }

        const allUserInstallationIds = [...new Set(allUserLinks.map(link => link.installation_id))];
        console.log('[User Installations] User has these installations across all orgs:', allUserInstallationIds);

        const availableInstallationIds = allUserInstallationIds.filter(
            id => !currentOrgInstallationIds.includes(id)
        );

        console.log('[User Installations] Available to link to current org:', availableInstallationIds);

        if (availableInstallationIds.length === 0) {
            console.log('[User Installations] No installations available to link - all are already linked to this org');
            return NextResponse.json({ installations: [] });
        }

        const { data: installations, error: installationsError } = await supabaseAdmin
            .from('github_app_installations')
            .select('installation_id, github_account_type, github_account_login, github_account_name')
            .in('installation_id', availableInstallationIds);

        if (installationsError) {
            console.error('[User Installations] Error fetching installation details:', installationsError);
            return NextResponse.json({ error: 'Failed to fetch installation details' }, { status: 500 });
        }

        console.log('[User Installations] Found', installations?.length || 0, 'available installations for org', currentOrgId);
        return NextResponse.json({ installations: installations || [] });
    } catch (error) {
        console.error('[User Installations] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
