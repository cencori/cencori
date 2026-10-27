import "server-only";

import webpush from "web-push";
import type { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * Studio's push notifications: "Tolu needs you", "New booking", "Paid".
 * Each device that turned notifications on is kept on the project
 * (`tool_connections`, connector_slug 'studio_push'), with the user it
 * belongs to. Sending is best-effort; a device that unsubscribed or is gone
 * (404 / 410) is dropped.
 */

type Admin = ReturnType<typeof createAdminClient>;

export const PUSH_SLUG = "studio_push";
const DEVICES_MAX = 50;

export interface PushDevice {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    user_id: string;
    created_at: string;
}

export interface PushMessage {
    title: string;
    body: string;
    /** Where tapping it opens, in Studio ("/inbox/…"). */
    url: string;
    /** Same tag replaces the earlier notification instead of stacking. */
    tag?: string;
}

export function pushConfigured(): boolean {
    return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

async function devicesRow(db: Admin, projectId: string): Promise<{ id: string; devices: PushDevice[] } | null> {
    const { data } = await db.from("tool_connections").select("id, metadata").eq("project_id", projectId).eq("connector_slug", PUSH_SLUG).limit(1).maybeSingle();
    if (!data) return null;
    const devices = (data.metadata as { devices?: PushDevice[] } | null)?.devices;
    return { id: data.id as string, devices: Array.isArray(devices) ? devices : [] };
}

async function saveDevices(db: Admin, projectId: string, rowId: string | null, devices: PushDevice[]): Promise<void> {
    const metadata = { kind: "studio_push", devices: devices.slice(-DEVICES_MAX) };
    if (rowId) await db.from("tool_connections").update({ metadata }).eq("id", rowId);
    else await db.from("tool_connections").insert({ project_id: projectId, connector_slug: PUSH_SLUG, owner_type: "platform", status: "active", metadata });
}

/** Turn notifications on for one device (replacing it if it was already on). */
export async function addPushDevice(db: Admin, projectId: string, userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    const row = await devicesRow(db, projectId);
    const device: PushDevice = { endpoint: subscription.endpoint, keys: subscription.keys, user_id: userId, created_at: new Date().toISOString() };
    await saveDevices(db, projectId, row?.id ?? null, [...(row?.devices ?? []).filter((d) => d.endpoint !== subscription.endpoint), device]);
}

export async function removePushDevice(db: Admin, projectId: string, endpoint: string): Promise<void> {
    const row = await devicesRow(db, projectId);
    if (row) await saveDevices(db, projectId, row.id, row.devices.filter((d) => d.endpoint !== endpoint));
}

/** Tell everyone on the project who turned notifications on. Never throws. */
export async function pushToOwners(db: Admin, projectId: string, message: PushMessage): Promise<void> {
    if (!pushConfigured()) return;
    try {
        const row = await devicesRow(db, projectId);
        if (!row || row.devices.length === 0) return;
        webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@cencori.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
        const payload = JSON.stringify(message);
        const gone: string[] = [];
        await Promise.all(row.devices.map(async (device) => {
            try {
                await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
            } catch (error) {
                const status = (error as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) gone.push(device.endpoint);
            }
        }));
        if (gone.length) await saveDevices(db, projectId, row.id, row.devices.filter((d) => !gone.includes(d.endpoint)));
    } catch (error) {
        console.error("[studio-push] send failed", error instanceof Error ? error.message : error);
    }
}
