/**
 * The business's time zone: what "today", "this week", a booking's time and
 * an event's start mean for it, in Studio, its alerts and its employees.
 *
 * It's kept on the owner-alerts rows (lib/embedded/owner-alerts.ts), the same
 * on every agent's. A business nobody chose a zone for was on Lagos; the first
 * time its owner opens Studio, the zone of their phone or browser is adopted
 * (once: travelling later doesn't move the business). One the owner chose is
 * never overwritten.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import { projectAlerts, saveOwnerAlerts, setProjectTimeZone, validTimeZone } from '@/lib/embedded/owner-alerts';
import { safeTimeZone } from '@/lib/studio/time';

type Admin = ReturnType<typeof createAdminClient>;

const cache = new Map<string, { zone: string; at: number }>();
const CACHE_MS = 60_000;

/** The business's zone (Lagos when none is set). Cached a minute: customer turns read it. */
export async function businessTimeZone(db: Admin, projectId: string): Promise<string> {
    const hit = cache.get(projectId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.zone;
    const rows = await projectAlerts(db, projectId).catch(() => []);
    // A chosen zone wins over one never set; the rows agree once it's set.
    const zone = safeTimeZone((rows.find((row) => row.settings.time_zone_source) ?? rows[0])?.settings.time_zone);
    cache.set(projectId, { zone, at: Date.now() });
    if (cache.size > 5_000) cache.delete(cache.keys().next().value!);
    return zone;
}

/**
 * The owner opened Studio from a device in `zone`: a business with no zone set
 * takes it. Returns the business's zone after, and whether it changed.
 */
export async function adoptTimeZone(db: Admin, projectId: string, zone: string): Promise<{ time_zone: string; adopted: boolean }> {
    const rows = await projectAlerts(db, projectId);
    const set = rows.find((row) => row.settings.time_zone_source);
    if (set || !validTimeZone(zone)) return { time_zone: safeTimeZone(set?.settings.time_zone ?? rows[0]?.settings.time_zone), adopted: false };
    if (rows.length) {
        await setProjectTimeZone(db, projectId, zone, 'device');
    } else {
        // No alerts yet: the zone goes on the first agent's row (no emails), where Studio reads it.
        const { data: agent } = await db.from('agents').select('id').eq('project_id', projectId).order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (!agent) return { time_zone: safeTimeZone(null), adopted: false };
        const saved = await saveOwnerAlerts(db, { projectId, agentId: (agent as { id: string }).id, existing: null, emails: [], timeZone: zone, timeZoneSource: 'device' });
        if (!saved.ok) return { time_zone: safeTimeZone(null), adopted: false };
    }
    cache.delete(projectId);
    return { time_zone: zone, adopted: true };
}
