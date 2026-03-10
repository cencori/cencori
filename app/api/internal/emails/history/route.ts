import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { allowAllInternalInDev, isFounderEmail } from '@/lib/internal-admin-auth';

export async function GET() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const isFounder = isFounderEmail(user.email);
    if (!isDev || !allowAllInternalInDev()) {
        if (!isFounder) {
            const admin = createAdminClient();
            const { data: adminRow } = await admin
                .from('cencori_admins')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .single();
            if (!adminRow) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from('email_sends')
        .select(`
            id,
            category,
            subject,
            audience_type,
            single_recipient,
            recipient_count,
            success_count,
            failure_count,
            status,
            sent_at,
            created_at,
            sender_profile_id,
            email_sender_profiles (
                display_name,
                email_handle
            )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sends: data || [] });
}
