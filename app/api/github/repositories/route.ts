import { NextRequest, NextResponse } from 'next/server';
import { getInstallationOctokit } from '@/lib/github';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const installationId = searchParams.get('installation_id');

    if (!installationId) {
        return NextResponse.json(
            { error: 'Installation ID is required' },
            { status: 400 }
        );
    }

    try {
        const installationOctokit = await getInstallationOctokit(Number(installationId));

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
