import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

// GET /api/scan/github/repos - Get all repos from user's GitHub installations
export async function GET() {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabaseAdmin = createAdminClient();

        // Get user's GitHub identity from their linked accounts
        const githubIdentity = user.identities?.find(i => i.provider === 'github');
        const githubUsername = githubIdentity?.identity_data?.user_name ||
            githubIdentity?.identity_data?.preferred_username ||
            null;

        // Collect installation IDs from multiple sources
        const installationIds: Set<number> = new Set();

        // 1. Get installations linked to user's organizations
        const { data: userOrgs } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id);

        if (userOrgs && userOrgs.length > 0) {
            const orgIds = userOrgs.map(o => o.id);
            const { data: links } = await supabaseAdmin
                .from('organization_github_installations')
                .select('installation_id')
                .in('organization_id', orgIds);

            links?.forEach(l => installationIds.add(l.installation_id));
        }

        // 2. Get installations where the GitHub account matches user's GitHub username
        if (githubUsername) {
            const { data: userInstallations } = await supabaseAdmin
                .from('github_app_installations')
                .select('installation_id')
                .ilike('github_account_login', githubUsername);

            userInstallations?.forEach(i => installationIds.add(i.installation_id));
        }

        if (installationIds.size === 0) {
            return NextResponse.json({
                repositories: [],
                message: 'No GitHub installations found. Please install the GitHub App.'
            });
        }

        // Fetch repos from all installations
        const allRepos: Array<{
            id: number;
            full_name: string;
            html_url: string;
            description: string | null;
            installation_id: number;
        }> = [];

        for (const installationId of installationIds) {
            try {
                const octokit = await getInstallationOctokit(installationId);
                const { data } = await octokit.request('GET /installation/repositories', {
                    per_page: 100,
                });

                for (const repo of data.repositories) {
                    allRepos.push({
                        id: repo.id,
                        full_name: repo.full_name,
                        html_url: repo.html_url,
                        description: repo.description,
                        installation_id: installationId,
                    });
                }
            } catch (err) {
                console.error(`[Scan GitHub] Error fetching repos for installation ${installationId}:`, err);
                // Continue with other installations
            }
        }

        // Get already-imported repos for this user
        const { data: existingProjects } = await supabaseAdmin
            .from('scan_projects')
            .select('github_repo_id')
            .eq('user_id', user.id);

        const importedRepoIds = new Set(existingProjects?.map(p => p.github_repo_id) || []);

        // Mark repos as already imported
        const repositories = allRepos.map(repo => ({
            ...repo,
            already_imported: importedRepoIds.has(repo.id),
        }));

        return NextResponse.json({ repositories });
    } catch (error) {
        console.error('[Scan GitHub] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
