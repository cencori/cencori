import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

interface Repo {
    id: number;
    full_name: string;
    html_url: string;
    description: string | null;
}

/**
 * GET /api/github/status?orgSlug=...
 *
 * Single server-side endpoint for the GitHub import page.
 * Uses the admin client to bypass RLS on organization_github_installations,
 * then fetches repos via the GitHub App installation.
 *
 * Returns:
 *  { status: 'not_installed', organizationId }
 *  { status: 'installed', organizationId, installationId, repositories }
 */
export async function GET(req: NextRequest) {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get('orgSlug');

    if (!orgSlug) {
        return NextResponse.json({ error: 'Missing orgSlug' }, { status: 400 });
    }

    // Verify the user has access to this org (owner or member)
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, slug')
        .eq('slug', orgSlug)
        .single();

    if (orgError || !orgData) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Use admin client to bypass RLS on organization_github_installations
    const supabaseAdmin = createAdminClient();

    const { data: linkData } = await supabaseAdmin
        .from('organization_github_installations')
        .select('installation_id')
        .eq('organization_id', orgData.id)
        .limit(1)
        .maybeSingle();

    if (!linkData) {
        return NextResponse.json({
            status: 'not_installed',
            organizationId: orgData.id,
        });
    }

    // Fetch the repos for this installation via GitHub App
    try {
        const octokit = await getInstallationOctokit(linkData.installation_id);
        const { data } = await octokit.request('GET /installation/repositories', {
            per_page: 100,
        });

        const repositories: Repo[] = data.repositories.map(repo => ({
            id: repo.id,
            full_name: repo.full_name,
            html_url: repo.html_url,
            description: repo.description,
        }));

        return NextResponse.json({
            status: 'installed',
            organizationId: orgData.id,
            installationId: linkData.installation_id,
            repositories,
        });
    } catch (err) {
        console.error('[GitHub Status] Error fetching repos for installation', linkData.installation_id, err);
        // Installation row exists but fetching repos failed — treat as not installed
        return NextResponse.json({
            status: 'not_installed',
            organizationId: orgData.id,
        });
    }
}
