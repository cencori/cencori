/**
 * GET /api/widget/frame/:key?mode=widget|inline|bare&preview=
 *
 * The chat page the loader puts in an iframe. Its frame-ancestors list is the
 * widget's allowed sites, so browsers refuse to show it anywhere else; a valid
 * console preview token adds Cencori's own origins instead. Lives under /api
 * so the app-wide X-Frame-Options: DENY and page CSP don't apply.
 */

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { WIDGET_COLUMNS, appOrigins, isWidgetKey, sanitizeAppearance, verifyWidgetPreviewToken, type WidgetRow } from '@/lib/embedded/widget';
import { widgetChatPage, widgetNonce, widgetUnavailablePage } from '@/lib/embedded/widget-page';

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
    const { key } = await ctx.params;
    const nonce = widgetNonce();
    if (!isWidgetKey(key)) return widgetUnavailablePage('This chat doesn’t exist.', nonce);

    const db = createAdminClient();
    const { data } = await db.from('agent_widgets').select(`${WIDGET_COLUMNS}, agents(name)`).eq('public_key', key).maybeSingle();
    const widget = data as (WidgetRow & { agents?: { name?: string } | null }) | null;
    if (!widget) return widgetUnavailablePage('This chat doesn’t exist.', nonce);

    const preview = verifyWidgetPreviewToken(req.nextUrl.searchParams.get('preview'), widget.id);
    const ancestors = preview ? appOrigins() : widget.allowed_origins;
    if (!preview && !widget.enabled) return widgetUnavailablePage('This chat is turned off.', nonce, ancestors);

    return widgetChatPage({
        key,
        agentId: widget.agent_id,
        mode: (() => {
            const mode = req.nextUrl.searchParams.get('mode');
            return mode === 'inline' || mode === 'bare' ? mode : 'widget';
        })(),
        appearance: sanitizeAppearance(widget.appearance, widget.agents?.name ?? 'Assistant'),
        nonce,
        ancestors,
        preview: preview ? req.nextUrl.searchParams.get('preview') : null,
    });
}
