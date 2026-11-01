/**
 * POST /api/studio/whatsapp/number
 *   { project_id, agent_id, action: 'send_code', phone, display_name?, method?: 'SMS' | 'VOICE' }
 *   { project_id, agent_id, action: 'verify', code }
 *
 * "Give your employee a WhatsApp number" with no Facebook login: Meta texts
 * or calls the number a code, the owner types it here, and the number is the
 * employee's (lib/channels/whatsapp-own-number.ts). A failure says why, with
 * `reason` ("on_whatsapp": the number is still on the WhatsApp app and its
 * account there has to be deleted first).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import type { SubscriptionTier } from '@/lib/entitlements';
import { sendNumberCode, verifyNumberCode } from '@/lib/channels/whatsapp-own-number';

const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const fail = (message: string, status = 400, reason?: string) => NextResponse.json({ error: message, ...(reason ? { reason } : {}) }, { status });

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isId(body?.project_id) || !isId(body?.agent_id)) return fail('Say which employee.');
    const projectId = body.project_id;
    const agentId = body.agent_id;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    if (!['owner', 'admin'].includes(access.role)) return fail('Only owners and admins can connect WhatsApp.', 403);
    const db = createAdminClient();
    const [{ data: agent }, { data: project }] = await Promise.all([
        db.from('agents').select('id, name').eq('project_id', projectId).eq('id', agentId).maybeSingle(),
        db.from('projects').select('name').eq('id', projectId).maybeSingle(),
    ]);
    if (!agent) return fail('That employee isn’t in this business.', 404);

    if (body.action === 'send_code') {
        const result = await sendNumberCode(db, {
            projectId,
            agentId,
            phone: typeof body.phone === 'string' ? body.phone : '',
            // What customers see as the chat's name: the business's, unless the owner changed it.
            displayName: typeof body.display_name === 'string' && body.display_name.trim() ? body.display_name : (project?.name as string | undefined) ?? '',
            method: body.method === 'VOICE' ? 'VOICE' : 'SMS',
        });
        if (!result.ok) return fail(result.message, result.status, result.reason);
        return NextResponse.json({ sent: true, phone: result.phone });
    }
    if (body.action === 'verify') {
        const result = await verifyNumberCode(db, {
            projectId,
            organizationId: access.organizationId,
            agentId,
            agentName: agent.name as string,
            tier: (access.subscriptionTier || 'free') as SubscriptionTier,
            code: typeof body.code === 'string' ? body.code : '',
        });
        if (!result.ok) return fail(result.message, result.status, 'reason' in result ? result.reason : undefined);
        return NextResponse.json({ connected: true, number: result.channel.metadata.display_phone_number ?? null, employee: agent.name });
    }
    return fail('Unknown step.');
}
