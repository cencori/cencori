import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { organizationId, installationId } = body;

        if (!organizationId || !installationId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .eq('id', organizationId)
            .eq('owner_id', user.id)
            .single();

        if (orgError || !org) {
            console.error('[Link Installation] User does not own organization:', orgError);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabaseAdmin = createAdminClient();

        const { data: installation, error: installationError } = await supabaseAdmin
            .from('github_app_installations')
            .select('installation_id')
            .eq('installation_id', installationId)
            .single();

        if (installationError || !installation) {
            console.error('[Link Installation] Installation not found:', installationError);
            return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
        }

        const { error: linkError } = await supabaseAdmin
            .from('organization_github_installations')
            .upsert({
                organization_id: organizationId,
                installation_id: installationId,
            }, { onConflict: 'organization_id, installation_id' });

        if (linkError) {
            console.error('[Link Installation] Error creating link:', linkError);
            return NextResponse.json({ error: 'Failed to link installation' }, { status: 500 });
        }

        console.log('[Link Installation] Successfully linked installation', installationId, 'to organization', organizationId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Link Installation] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
