import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkInternalAccess } from '@/lib/internal-access';

const USERS_PAGE_SIZE = 200;

export async function POST(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await checkInternalAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const maxRecipients = Math.min(Math.max(Number(body.maxRecipients) || 500, 1), 2000);

    // Count confirmed users
    const supabaseAdmin = createAdminClient();
    let confirmedCount = 0;
    let totalUsers = 0;
    let page = 1;

    while (confirmedCount < maxRecipients) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: USERS_PAGE_SIZE,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const users = data?.users ?? [];
        totalUsers += users.length;

        for (const u of users) {
            if (u.email_confirmed_at && u.email?.trim()) {
                confirmedCount++;
                if (confirmedCount >= maxRecipients) break;
            }
        }

        if (!data?.nextPage || users.length === 0) break;
        page = data.nextPage;
    }

    return NextResponse.json({
        totalUsers,
        eligibleRecipients: confirmedCount,
        maxRecipients,
        capped: confirmedCount >= maxRecipients,
    });
}
