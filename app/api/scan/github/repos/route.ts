import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { getReachableGithubInstallationIds } from '@/lib/github-installations';

// GET /api/scan/github/repos - Get all repos from user's GitHub installations
export async function GET() {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabaseAdmin = createAdminClient();
        const installationIds = await getReachableGithubInstallationIds(user);

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

        // Collect installation details map
        const installationsMap = new Map<number, { id: number; account_login: string; account_avatar_url: string; account_type: string }>();

        for (const installationId of installationIds) {
            try {
                const octokit = await getInstallationOctokit(installationId);
                const { data } = await octokit.request('GET /installation/repositories', {
                    per_page: 100,
                });

                if (data.repositories.length > 0) {
                    // Use the first repo's owner info to populate installation details
                    const owner = data.repositories[0].owner;
                    installationsMap.set(installationId, {
                        id: installationId,
                        account_login: owner.login,
                        account_avatar_url: owner.avatar_url,
                        account_type: owner.type,
                    });
                }

                for (const repo of data.repositories) {
                    // Update installation map if not set (e.g. if we want to be safe)
                    if (!installationsMap.has(installationId)) {
                        installationsMap.set(installationId, {
                            id: installationId,
                            account_login: repo.owner.login,
                            account_avatar_url: repo.owner.avatar_url,
                            account_type: repo.owner.type,
                        });
                    }

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

        const installations = Array.from(installationsMap.values());

        return NextResponse.json({ repositories, installations });
    } catch (error) {
        console.error('[Scan GitHub] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
