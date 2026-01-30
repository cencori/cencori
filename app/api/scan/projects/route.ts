import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

// GET /api/scan/projects - List user's scan projects
export async function GET() {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabaseAdmin = createAdminClient();

        const { data: projects, error: projectsError } = await supabaseAdmin
            .from('scan_projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (projectsError) {
            console.error('[Scan Projects] Error fetching projects:', projectsError);
            return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
        }

        return NextResponse.json({ projects: projects || [] });
    } catch (error) {
        console.error('[Scan Projects] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/scan/projects - Import a GitHub repo as a scan project
export async function POST(req: NextRequest) {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const {
            github_repo_id,
            github_repo_full_name,
            github_repo_url,
            github_repo_description,
            github_installation_id
        } = body;

        if (!github_repo_id || !github_repo_full_name || !github_installation_id) {
            return NextResponse.json({
                error: 'Missing required fields: github_repo_id, github_repo_full_name, github_installation_id'
            }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // Check if project already exists for this user
        const { data: existingProject } = await supabaseAdmin
            .from('scan_projects')
            .select('id')
            .eq('user_id', user.id)
            .eq('github_repo_id', github_repo_id)
            .single();

        if (existingProject) {
            return NextResponse.json({
                error: 'Repository already imported',
                project: existingProject
            }, { status: 409 });
        }

        // Create the project
        const { data: project, error: insertError } = await supabaseAdmin
            .from('scan_projects')
            .insert({
                user_id: user.id,
                github_repo_id,
                github_repo_full_name,
                github_repo_url: github_repo_url || `https://github.com/${github_repo_full_name}`,
                github_repo_description,
                github_installation_id,
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Scan Projects] Error creating project:', insertError);
            return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
        }

        console.log('[Scan Projects] Created project:', project.id, github_repo_full_name);

        return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
        console.error('[Scan Projects] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
