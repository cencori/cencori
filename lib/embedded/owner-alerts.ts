/**
 * Owner alerts: an agent's owner hears about what needs them, by email.
 *
 * - A booking: the agent created a calendar event (a reservation, an
 *   appointment) in a conversation.
 * - A callback request: the agent took someone's details for the team to call
 *   back (the request_callback system tool), e.g. a party too big to book.
 * - A morning summary of the day before, in the owner's time zone.
 *
 * Settings live on a project `tool_connections` row per agent
 * (`connector_slug = 'owner-alerts'`), with a short rolling log of recent
 * alerts that the morning summary is written from.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import { escapeHtml, sendEmail } from '@/lib/email/sendbyte';

type Admin = ReturnType<typeof createAdminClient>;

export const OWNER_ALERTS_SLUG = 'owner-alerts';
const MAX_EMAILS = 5;
/** Alerts kept for the morning summary; older ones roll off. */
const LOG_KEEP_HOURS = 48;
const LOG_MAX = 300;

export interface OwnerAlertEntry {
    type: 'booking' | 'callback';
    at: string;
    title: string;
    when?: string | null;
    contact?: string | null;
    detail?: string | null;
    source?: string | null;
}

export interface OwnerAlertSettings {
    kind: 'owner_alerts';
    agent_id: string;
    emails: string[];
    bookings: boolean;
    callbacks: boolean;
    daily_summary: boolean;
    time_zone: string;
    /** The local date (YYYY-MM-DD) the last morning summary covered. */
    last_summary_for: string | null;
    log: OwnerAlertEntry[];
}

export interface OwnerAlerts {
    id: string;
    projectId: string;
    settings: OwnerAlertSettings;
}

const COLUMNS = 'id, project_id, metadata';

function toAlerts(row: Record<string, unknown> | null): OwnerAlerts | null {
    const settings = row?.metadata as OwnerAlertSettings | undefined;
    if (!row || settings?.kind !== 'owner_alerts') return null;
    return { id: row.id as string, projectId: row.project_id as string, settings: { ...settings, log: Array.isArray(settings.log) ? settings.log : [] } };
}

export async function getOwnerAlerts(db: Admin, projectId: string, agentId: string): Promise<OwnerAlerts | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS)
        .eq('project_id', projectId).eq('connector_slug', OWNER_ALERTS_SLUG).eq('metadata->>agent_id', agentId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return toAlerts(data as Record<string, unknown> | null);
}

/** What the console sees and edits. */
export function publicAlerts(alerts: OwnerAlerts | null) {
    const s = alerts?.settings;
    return {
        emails: s?.emails ?? [],
        bookings: s?.bookings ?? true,
        callbacks: s?.callbacks ?? true,
        daily_summary: s?.daily_summary ?? true,
        time_zone: s?.time_zone ?? 'Africa/Lagos',
        recent: (s?.log ?? []).slice(-10).reverse(),
    };
}

export function validTimeZone(zone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

export async function saveOwnerAlerts(
    db: Admin,
    opts: { projectId: string; agentId: string; existing: OwnerAlerts | null; emails: unknown; bookings?: unknown; callbacks?: unknown; dailySummary?: unknown; timeZone?: unknown },
): Promise<{ ok: true; alerts: OwnerAlerts } | { ok: false; message: string }> {
    const list = Array.isArray(opts.emails) ? opts.emails : [];
    const emails = [...new Set(list.filter((e): e is string => typeof e === 'string').map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (emails.length > MAX_EMAILS) return { ok: false, message: `Up to ${MAX_EMAILS} email addresses.` };
    const bad = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad) return { ok: false, message: `${bad} isn't an email address.` };
    const timeZone = typeof opts.timeZone === 'string' && validTimeZone(opts.timeZone) ? opts.timeZone : opts.existing?.settings.time_zone ?? 'Africa/Lagos';
    const flag = (value: unknown, current: boolean | undefined) => (typeof value === 'boolean' ? value : current ?? true);
    const settings: OwnerAlertSettings = {
        kind: 'owner_alerts',
        agent_id: opts.agentId,
        emails,
        bookings: flag(opts.bookings, opts.existing?.settings.bookings),
        callbacks: flag(opts.callbacks, opts.existing?.settings.callbacks),
        daily_summary: flag(opts.dailySummary, opts.existing?.settings.daily_summary),
        time_zone: timeZone,
        last_summary_for: opts.existing?.settings.last_summary_for ?? null,
        log: opts.existing?.settings.log ?? [],
    };
    const row = { project_id: opts.projectId, connector_slug: OWNER_ALERTS_SLUG, owner_type: 'platform', status: 'active', metadata: settings };
    const write = opts.existing
        ? db.from('tool_connections').update({ metadata: settings }).eq('id', opts.existing.id).select(COLUMNS).single()
        : db.from('tool_connections').insert(row).select(COLUMNS).single();
    const { data, error } = await write;
    const alerts = toAlerts(data as Record<string, unknown> | null);
    if (error || !alerts) return { ok: false, message: 'Couldn\'t save the alerts. Try again.' };
    return { ok: true, alerts };
}

/** A tool that books something: a calendar event, an appointment, a reservation. */
export function isBookingTool(name: string): boolean {
    return /(^|__)(create|book)[-_](event|booking|appointment|reservation|all-day-event|recurring-event)$/i.test(name);
}

/** The booking's details from the tool's arguments (Google Calendar's create-event shape, loosely). */
export function bookingFromArgs(argsJson: string): { title: string; start: string | null; detail: string | null } {
    let args: Record<string, unknown> = {};
    try {
        args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
    } catch {
        // keep defaults
    }
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const start = args.start as { dateTime?: unknown; date?: unknown } | string | undefined;
    return {
        title: text(args.summary) ?? text(args.title) ?? text(args.name) ?? 'New booking',
        start: typeof start === 'string' ? start : text(start?.dateTime) ?? text(start?.date) ?? text(args.startTime) ?? text(args.start_time),
        detail: text(args.description) ?? text(args.notes),
    };
}

/** "Fri 30 Oct, 8:00 pm" in the owner's time zone; the raw value when it isn't a date. */
export function formatWhen(value: string | null | undefined, timeZone: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    return date.toLocaleString('en-GB', dateOnly
        ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
        : { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone });
}

const SOURCE_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', widget: 'your website', link: 'your chat link' };

/** Where the conversation is happening, and the customer's number when it's WhatsApp. */
async function conversationSource(db: Admin, surface: string, conversationId: string | null | undefined): Promise<string> {
    if (surface === 'preview') return 'Preview (a test in the console)';
    if (surface === 'run') return 'an API run';
    if (!conversationId) return 'a conversation';
    const { data } = await db.from('sessions').select('metadata').eq('id', conversationId).maybeSingle();
    const meta = (data?.metadata ?? {}) as { source?: string; customer_number?: string; customer_name?: string };
    const where = SOURCE_LABELS[meta.source ?? ''] ?? 'a conversation';
    const who = [meta.customer_name, meta.customer_number ? `+${meta.customer_number.replace(/^\+/, '')}` : null].filter(Boolean).join(', ');
    return who ? `${where} (${who})` : where;
}

async function appendLog(db: Admin, alerts: OwnerAlerts, entry: OwnerAlertEntry): Promise<void> {
    const cutoff = Date.now() - LOG_KEEP_HOURS * 3_600_000;
    const log = [...alerts.settings.log.filter((e) => new Date(e.at).getTime() >= cutoff), entry].slice(-LOG_MAX);
    // Re-read so a concurrent settings save isn't overwritten with stale fields.
    const { data } = await db.from('tool_connections').select('metadata').eq('id', alerts.id).maybeSingle();
    const current = (data?.metadata ?? alerts.settings) as OwnerAlertSettings;
    await db.from('tool_connections').update({ metadata: { ...current, log } }).eq('id', alerts.id);
}

function emailLayout(heading: string, rows: Array<[string, string | null | undefined]>, footer: string): string {
    const body = rows.filter(([, value]) => value).map(([label, value]) => `
        <tr><td style="color:#71717a;padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="color:#18181b;padding:6px 0">${escapeHtml(value!).replace(/\n/g, '<br>')}</td></tr>`).join('');
    return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
<h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#18181b">${escapeHtml(heading)}</h1>
<table style="border-collapse:collapse;font-size:14px;width:100%">${body}</table>
<p style="margin:24px 0 0;font-size:12px;color:#a1a1aa">${escapeHtml(footer)}</p>
</div></body></html>`;
}

interface AlertContext {
    db: Admin;
    projectId: string;
    agentId: string;
    agentName?: string;
    surface: string;
    conversationId?: string | null;
}

/** Email the owner about a booking the agent just made. Best-effort; never throws. */
export async function notifyBooking(ctx: AlertContext, argsJson: string): Promise<void> {
    try {
        const alerts = await getOwnerAlerts(ctx.db, ctx.projectId, ctx.agentId);
        if (!alerts) return;
        const booking = bookingFromArgs(argsJson);
        const when = formatWhen(booking.start, alerts.settings.time_zone);
        const source = await conversationSource(ctx.db, ctx.surface, ctx.conversationId);
        await appendLog(ctx.db, alerts, { type: 'booking', at: new Date().toISOString(), title: booking.title, when, detail: booking.detail, source });
        if (!alerts.settings.bookings || alerts.settings.emails.length === 0) return;
        const name = ctx.agentName || 'Your agent';
        const test = ctx.surface === 'preview' ? '[Preview] ' : '';
        await sendEmail({
            to: alerts.settings.emails,
            subject: `${test}New booking: ${booking.title}${when ? `, ${when}` : ''}`,
            html: emailLayout(`${name} made a booking`, [['Booking', booking.title], ['When', when], ['Details', booking.detail], ['From', source]], 'It\'s on your calendar too. You get this because owner alerts are on for this agent in Cencori.'),
        });
    } catch (error) {
        console.error('[owner-alerts] booking alert failed', error instanceof Error ? error.message : error);
    }
}

/**
 * Ask the team to call someone back. Returns whether anyone will hear about
 * it, so the agent never promises a callback that goes nowhere.
 */
export async function notifyCallback(ctx: AlertContext, request: { name: string | null; contact: string; reason: string }): Promise<boolean> {
    const alerts = await getOwnerAlerts(ctx.db, ctx.projectId, ctx.agentId);
    if (!alerts || !alerts.settings.callbacks || alerts.settings.emails.length === 0) return false;
    const source = await conversationSource(ctx.db, ctx.surface, ctx.conversationId);
    const name = ctx.agentName || 'Your agent';
    const test = ctx.surface === 'preview' ? '[Preview] ' : '';
    const sent = await sendEmail({
        to: alerts.settings.emails,
        subject: `${test}Call back ${request.name ?? request.contact}: ${request.reason.slice(0, 80)}`,
        html: emailLayout(`${name} needs you to call someone back`, [['Name', request.name], ['Contact', request.contact], ['What they need', request.reason], ['From', source]], 'You get this because owner alerts are on for this agent in Cencori.'),
    });
    if (sent) await appendLog(ctx.db, alerts, { type: 'callback', at: new Date().toISOString(), title: request.reason.slice(0, 200), contact: request.contact, detail: request.name, source }).catch(() => undefined);
    return sent;
}

/** A test email, so the owner knows alerts reach them. */
export async function sendTestAlert(alerts: OwnerAlerts, agentName: string): Promise<boolean> {
    return sendEmail({
        to: alerts.settings.emails,
        subject: `Test alert from ${agentName}`,
        html: emailLayout(`Alerts from ${agentName} reach you`, [['Bookings', alerts.settings.bookings ? 'On' : 'Off'], ['Callback requests', alerts.settings.callbacks ? 'On' : 'Off'], ['Morning summary', alerts.settings.daily_summary ? `On, around 8am ${alerts.settings.time_zone.replace('_', ' ')}` : 'Off']], 'This is a test from Cencori owner alerts.'),
    });
}

/** The local calendar date and hour in a time zone. */
export function localDateHour(now: Date, timeZone: string): { date: string; hour: number } {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/** Summaries go out at this local hour, covering the day before. */
export const SUMMARY_HOUR = 8;

/**
 * Send every morning summary that's due: agents with the summary on, at 8am
 * their time, once per day, when something happened the day before.
 */
export async function sendDueSummaries(db: Admin, now = new Date()): Promise<{ sent: number; skipped: number }> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('connector_slug', OWNER_ALERTS_SLUG).eq('status', 'active').limit(5_000);
    let sent = 0;
    let skipped = 0;
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const alerts = toAlerts(row);
        if (!alerts || !alerts.settings.daily_summary || alerts.settings.emails.length === 0) continue;
        const { date, hour } = localDateHour(now, alerts.settings.time_zone);
        if (hour < SUMMARY_HOUR || alerts.settings.last_summary_for === date) continue;
        // The day before, in the owner's time zone.
        const yesterday = localDateHour(new Date(now.getTime() - 24 * 3_600_000), alerts.settings.time_zone).date;
        const entries = alerts.settings.log.filter((e) => localDateHour(new Date(e.at), alerts.settings.time_zone).date === yesterday);
        await db.from('tool_connections').update({ metadata: { ...alerts.settings, last_summary_for: date } }).eq('id', alerts.id);
        if (entries.length === 0) {
            skipped++;
            continue;
        }
        const { data: agent } = await db.from('agents').select('name').eq('id', alerts.settings.agent_id).maybeSingle();
        const agentName = (agent?.name as string | undefined) ?? 'Your agent';
        const bookings = entries.filter((e) => e.type === 'booking');
        const callbacks = entries.filter((e) => e.type === 'callback');
        const line = (e: OwnerAlertEntry) => e.type === 'booking'
            ? `${e.title}${e.when ? `, ${e.when}` : ''}${e.source ? ` (via ${e.source})` : ''}`
            : `${e.detail ? `${e.detail}, ` : ''}${e.contact}: ${e.title}`;
        const ok = await sendEmail({
            to: alerts.settings.emails,
            subject: `${agentName} yesterday: ${bookings.length} booking${bookings.length === 1 ? '' : 's'}${callbacks.length ? `, ${callbacks.length} to call back` : ''}`,
            html: emailLayout(`What ${agentName} did yesterday`, [
                [`Bookings (${bookings.length})`, bookings.map(line).join('\n') || 'None'],
                [`Call back (${callbacks.length})`, callbacks.map(line).join('\n') || 'None'],
            ], 'Sent each morning by Cencori owner alerts. Turn it off in the agent\'s settings.'),
        });
        if (ok) sent++;
    }
    return { sent, skipped };
}
