import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';

const FOUNDER_EMAILS = ['omogbolahanng@gmail.com'];

export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailLower = email.toLowerCase();
    if (emailLower !== user.email.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (FOUNDER_EMAILS.includes(emailLower)) {
        return NextResponse.json({ authorized: true, role: 'founder' });
    }
    const supabaseAdmin = createAdminClient();
    const { data: admin } = await supabaseAdmin
        .from('cencori_admins')
        .select('id, role, status')
        .eq('email', emailLower)
        .eq('status', 'active')
        .single();

    if (admin) {
        return NextResponse.json({ authorized: true, role: admin.role });
    }

    return NextResponse.json({ error: 'Access denied - Not an authorized admin' }, { status: 403 });
}
