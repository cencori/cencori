import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

interface WebhookUpdateBody {
    name?: string;
    url?: string;
    events?: string[];
    is_active?: boolean;
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; webhookId: string }> }
) {
    const { projectId, webhookId } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: webhook, error: webhookError } = await supabase
        .from('webhooks')
        .select('id, project_id, projects!inner(organization_id, organizations!inner(owner_id))')
        .eq('id', webhookId)
        .eq('project_id', projectId)
        .single();

    if (webhookError || !webhook) {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const body: WebhookUpdateBody = await req.json();

    if (body.url) {
        try {
            new URL(body.url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }
    }

    const { data: updatedWebhook, error: updateError } = await supabase
        .from('webhooks')
        .update({
            ...body,
            updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId)
        .select('id, name, url, events, is_active, updated_at')
        .single();

    if (updateError) {
        console.error('Error updating webhook:', updateError);
        return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
    }

    return NextResponse.json({ webhook: updatedWebhook });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; webhookId: string }> }
) {
    const { projectId, webhookId } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: webhook, error: webhookError } = await supabase
        .from('webhooks')
        .select('id, project_id, projects!inner(organization_id, organizations!inner(owner_id))')
        .eq('id', webhookId)
        .eq('project_id', projectId)
        .single();

    if (webhookError || !webhook) {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId);

    if (deleteError) {
        console.error('Error deleting webhook:', deleteError);
        return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
