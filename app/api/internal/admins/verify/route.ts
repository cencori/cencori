import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

const FOUNDER_EMAILS = ['omogbolahanng@gmail.com'];

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { email } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailLower = email.toLowerCase();

    if (FOUNDER_EMAILS.includes(emailLower)) {
        return NextResponse.json({ authorized: true, role: 'founder' });
    }
    const supabase = createAdminClient();
    const { data: admin } = await supabase
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
