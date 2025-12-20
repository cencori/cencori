import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

interface WebhookBody {
    name: string;
    url: string;
    events?: string[];
    secret?: string;
}

// GET - List all webhooks for a project
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, organization_id, organizations!inner(owner_id)')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch webhooks
    const { data: webhooks, error: webhooksError } = await supabase
        .from('webhooks')
        .select('id, name, url, events, is_active, created_at, last_triggered_at, failure_count')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (webhooksError) {
        return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
    }

    return NextResponse.json({ webhooks });
}

// POST - Create a new webhook
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, organization_id, organizations!inner(owner_id)')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body: WebhookBody = await req.json();

    // Validate required fields
    if (!body.name || !body.url) {
        return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    // Validate URL format
    try {
        new URL(body.url);
    } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Generate a secret if not provided
    const secret = body.secret || crypto.randomBytes(32).toString('hex');

    // Create webhook
    const { data: webhook, error: createError } = await supabase
        .from('webhooks')
        .insert({
            project_id: projectId,
            name: body.name,
            url: body.url,
            events: body.events || ['request.completed'],
            secret,
            is_active: true,
        })
        .select('id, name, url, events, is_active, created_at, secret')
        .single();

    if (createError) {
        console.error('Error creating webhook:', createError);
        return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
    }

    return NextResponse.json({ webhook }, { status: 201 });
}
