import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();

    // Get the organization ID from query params
    const { searchParams } = new URL(req.url);
    const currentOrgId = searchParams.get('organizationId');

    if (!currentOrgId) {
        return NextResponse.json({ error: 'Missing organizationId parameter' }, { status: 400 });
    }

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get all organizations owned by the user
        const { data: ownedOrgs, error: orgsError } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id);

        if (orgsError) {
            console.error('[User Installations] Error fetching owned organizations:', orgsError);
            return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
        }

        if (!ownedOrgs || ownedOrgs.length === 0) {
            return NextResponse.json({ installations: [] });
        }

        const orgIds = ownedOrgs.map(org => org.id);

        // Get all installation IDs linked to ANY of user's organizations
        const { data: allLinkedInstallations, error: linksError } = await supabase
            .from('organization_github_installations')
            .select('installation_id')
            .in('organization_id', orgIds);

        if (linksError) {
            console.error('[User Installations] Error fetching linked installations:', linksError);
            return NextResponse.json({ error: 'Failed to fetch installations' }, { status: 500 });
        }

        if (!allLinkedInstallations || allLinkedInstallations.length === 0) {
            return NextResponse.json({ installations: [] });
        }

        // Get unique installation IDs
        const uniqueInstallationIds = [...new Set(allLinkedInstallations.map(link => link.installation_id))];

        // Get installations already linked to the CURRENT organization
        const { data: currentOrgLinks, error: currentLinksError } = await supabase
            .from('organization_github_installations')
            .select('installation_id')
            .eq('organization_id', currentOrgId);

        if (currentLinksError) {
            console.error('[User Installations] Error fetching current org links:', currentLinksError);
        }

        const currentOrgInstallationIds = currentOrgLinks?.map(link => link.installation_id) || [];

        // Filter out installations already linked to current org
        const availableInstallationIds = uniqueInstallationIds.filter(
            id => !currentOrgInstallationIds.includes(id)
        );

        if (availableInstallationIds.length === 0) {
            return NextResponse.json({ installations: [] });
        }

        // Get installation details
        const { data: installations, error: installationsError } = await supabase
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
