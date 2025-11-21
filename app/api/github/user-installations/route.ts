import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();

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

        // Get all installation IDs linked to user's organizations
        const { data: linkedInstallations, error: linksError } = await supabase
            .from('organization_github_installations')
            .select('installation_id')
            .in('organization_id', orgIds);

        if (linksError) {
            console.error('[User Installations] Error fetching linked installations:', linksError);
            return NextResponse.json({ error: 'Failed to fetch installations' }, { status: 500 });
        }

        if (!linkedInstallations || linkedInstallations.length === 0) {
            return NextResponse.json({ installations: [] });
        }

        const installationIds = linkedInstallations.map(link => link.installation_id);

        // Get installation details
        const { data: installations, error: installationsError } = await supabase
            .from('github_app_installations')
            .select('installation_id, github_account_type, github_account_login, github_account_name')
            .in('installation_id', installationIds);

        if (installationsError) {
            console.error('[User Installations] Error fetching installation details:', installationsError);
            return NextResponse.json({ error: 'Failed to fetch installation details' }, { status: 500 });
        }

        return NextResponse.json({ installations: installations || [] });
    } catch (error) {
        console.error('[User Installations] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
