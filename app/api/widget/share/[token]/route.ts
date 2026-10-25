/**
 * GET /api/widget/share/:token (public as /talk/:token)
 *
 * An agent's shareable link: the widget chat as a full page, for anyone with
 * the link. The token is signed, so the widget's public key alone can't open
 * it; the visitor limits still apply, and rotating the key retires the link.
 * Lives under /api for the same reason as the frame: its own CSP.
 */

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { WIDGET_COLUMNS, sanitizeAppearance, shareTokenKey, verifyWidgetShareToken, type WidgetRow } from '@/lib/embedded/widget';
import { widgetChatPage, widgetNonce, widgetUnavailablePage } from '@/lib/embedded/widget-page';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    const nonce = widgetNonce();
    const key = shareTokenKey(token);
    if (!key) return widgetUnavailablePage('This link doesn’t work anymore.', nonce, []);

    const db = createAdminClient();
    const { data } = await db.from('agent_widgets').select(`${WIDGET_COLUMNS}, agents(name)`).eq('public_key', key).maybeSingle();
    const widget = data as (WidgetRow & { agents?: { name?: string } | null }) | null;
    if (!widget || !verifyWidgetShareToken(token, widget)) return widgetUnavailablePage('This link doesn’t work anymore.', nonce, []);

    return widgetChatPage({
        key,
        agentId: widget.agent_id,
        mode: 'page',
        appearance: sanitizeAppearance(widget.appearance, widget.agents?.name ?? 'Assistant'),
        nonce,
        ancestors: [],
        share: token,
    });
}
