/**
 * POST /api/studio/time-zone  { project_id, time_zone }
 *      Studio opened on a device in time_zone (IANA, "Europe/London"): a
 *      business nobody chose a zone for takes it, once (lib/studio/business-zone.ts).
 *      Owners and admins only; anyone else just hears the business's zone.
 *      → { time_zone, adopted }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { adoptTimeZone, businessTimeZone } from '@/lib/studio/business-zone';

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; time_zone?: unknown } | null;
    if (typeof body?.project_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.project_id)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!['owner', 'admin'].includes(access.role) || typeof body.time_zone !== 'string' || body.time_zone.length > 64) {
        return NextResponse.json({ time_zone: await businessTimeZone(db, body.project_id), adopted: false });
    }
    return NextResponse.json(await adoptTimeZone(db, body.project_id, body.time_zone));
}
