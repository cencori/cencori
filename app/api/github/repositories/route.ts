import { NextRequest, NextResponse } from 'next/server';
import { getInstallationOctokit } from '@/lib/github';
import { createServerClient } from '@/lib/supabaseServer';
import { getReachableGithubInstallationIds } from '@/lib/github-installations';

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const installationIdParam = searchParams.get('installation_id');

    if (!installationIdParam) {
        return NextResponse.json(
            { error: 'Installation ID is required' },
            { status: 400 }
        );
    }

    const installationId = Number(installationIdParam);
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
        return NextResponse.json(
            { error: 'Invalid installation ID' },
            { status: 400 }
        );
    }

    try {
        const reachableInstallations = await getReachableGithubInstallationIds(user);
        if (!reachableInstallations.has(installationId)) {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }

        const installationOctokit = await getInstallationOctokit(installationId);

        const { data } = await installationOctokit.request('GET /installation/repositories', {
            per_page: 100,
        });

        const repositories = data.repositories.map(repo => ({
            id: repo.id,
            full_name: repo.full_name,
            html_url: repo.html_url,
            description: repo.description,
        }));

        return NextResponse.json({ repositories });
    } catch (error) {
        console.error('Error fetching repositories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch repositories' },
            { status: 500 }
        );
    }
}
