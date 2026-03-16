import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { allowAllInternalInDev, isFounderEmail } from '@/lib/internal-admin-auth';
import { MODEL_MAPPINGS } from '@/lib/providers/failover';

// POST — seed DB with hardcoded MODEL_MAPPINGS (idempotent via upsert)
export async function POST() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const isAdmin = allowAllInternalInDev() && isDev || isFounderEmail(user.email);

    if (!isAdmin) {
        const supabaseAdmin = createAdminClient();
        const { data } = await supabaseAdmin
            .from('cencori_admins')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();
        if (!data) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const rows: { source_model: string; target_provider: string; target_model: string; created_by: string }[] = [];

    for (const [sourceModel, targets] of Object.entries(MODEL_MAPPINGS)) {
        for (const [targetProvider, targetModel] of Object.entries(targets)) {
            rows.push({
                source_model: sourceModel,
                target_provider: targetProvider,
                target_model: targetModel,
                created_by: user.id,
            });
        }
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
        .from('model_mappings')
        .upsert(rows, { onConflict: 'source_model,target_provider' });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ seeded: rows.length });
}
