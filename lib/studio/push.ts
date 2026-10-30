import "server-only";

import webpush from "web-push";
import type { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * Studio's push notifications: "Tolu needs you", "New booking", "Paid".
 * Each device that turned notifications on is kept on the project
 * (`tool_connections`, connector_slug 'studio_push'), with the user it
 * belongs to: a browser's Web Push subscription (sent with VAPID), or the
 * mobile app's Expo push token (sent through Expo's push service). Sending is
 * best-effort; a device that unsubscribed or is gone is dropped.
 */

type Admin = ReturnType<typeof createAdminClient>;

export const PUSH_SLUG = "studio_push";
const DEVICES_MAX = 50;
const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
/** Expo takes at most 100 messages a request. */
const EXPO_BATCH = 100;
const TTL_SECONDS = 60 * 60 * 24;

/** A browser's Web Push subscription. Rows saved before the app existed have no `kind`. */
export interface WebPushDevice {
    kind?: "web";
    endpoint: string;
    keys: { p256dh: string; auth: string };
    user_id: string;
    created_at: string;
}

/** The mobile app's Expo push token. */
export interface ExpoPushDevice {
    kind: "expo";
    token: string;
    user_id: string;
    created_at: string;
}

export type PushDevice = WebPushDevice | ExpoPushDevice;

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

export function isExpoPushToken(value: unknown): value is string {
    return typeof value === "string" && value.length <= 200 && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(value);
}

/** What identifies a device: its endpoint, or its Expo token. */
const deviceKey = (device: PushDevice): string => (device.kind === "expo" ? device.token : device.endpoint);

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

async function addDevice(db: Admin, projectId: string, device: PushDevice): Promise<void> {
    const row = await devicesRow(db, projectId);
    const key = deviceKey(device);
    await saveDevices(db, projectId, row?.id ?? null, [...(row?.devices ?? []).filter((d) => deviceKey(d) !== key), device]);
}

/** Turn notifications on for one browser (replacing it if it was already on). */
export async function addPushDevice(db: Admin, projectId: string, userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    await addDevice(db, projectId, { endpoint: subscription.endpoint, keys: subscription.keys, user_id: userId, created_at: new Date().toISOString() });
}

/** Turn notifications on for one phone running the app (replacing it if it was already on). */
export async function addExpoPushDevice(db: Admin, projectId: string, userId: string, token: string): Promise<void> {
    await addDevice(db, projectId, { kind: "expo", token, user_id: userId, created_at: new Date().toISOString() });
}

/** Turn notifications off for a device, by its endpoint or Expo token. */
export async function removePushDevice(db: Admin, projectId: string, key: string): Promise<void> {
    const row = await devicesRow(db, projectId);
    if (row) await saveDevices(db, projectId, row.id, row.devices.filter((d) => deviceKey(d) !== key));
}

/** Send to browsers; returns the endpoints that are gone. */
async function sendWeb(devices: WebPushDevice[], message: PushMessage): Promise<string[]> {
    if (devices.length === 0 || !pushConfigured()) return [];
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@cencori.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const payload = JSON.stringify(message);
    const gone: string[] = [];
    await Promise.all(devices.map(async (device) => {
        try {
            await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, payload, { TTL: TTL_SECONDS, urgency: "high" });
        } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) gone.push(device.endpoint);
        }
    }));
    return gone;
}

/** Send to phones through Expo; returns the tokens Expo says are no longer registered. */
export async function sendExpo(devices: ExpoPushDevice[], message: PushMessage, fetcher: typeof fetch = fetch): Promise<string[]> {
    const gone: string[] = [];
    for (let i = 0; i < devices.length; i += EXPO_BATCH) {
        const batch = devices.slice(i, i + EXPO_BATCH);
        const response = await fetcher(EXPO_SEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                // Only needed once enhanced push security is turned on for the Expo project.
                ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
            },
            body: JSON.stringify(batch.map((device) => ({
                to: device.token,
                title: message.title,
                body: message.body,
                data: { url: message.url, tag: message.tag },
                sound: "default",
                priority: "high",
                ttl: TTL_SECONDS,
            }))),
        }).catch(() => null);
        if (!response?.ok) continue;
        // One ticket per message, in order.
        const tickets = ((await response.json().catch(() => null)) as { data?: Array<{ status?: string; details?: { error?: string } }> } | null)?.data;
        tickets?.forEach((ticket, index) => {
            if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" && batch[index]) gone.push(batch[index].token);
        });
    }
    return gone;
}

/** Tell everyone on the project who turned notifications on. Never throws. */
export async function pushToOwners(db: Admin, projectId: string, message: PushMessage): Promise<void> {
    try {
        const row = await devicesRow(db, projectId);
        if (!row || row.devices.length === 0) return;
        const web = row.devices.filter((d): d is WebPushDevice => d.kind !== "expo");
        const expo = row.devices.filter((d): d is ExpoPushDevice => d.kind === "expo");
        const gone = (await Promise.all([sendWeb(web, message), sendExpo(expo, message)])).flat();
        if (gone.length) await saveDevices(db, projectId, row.id, row.devices.filter((d) => !gone.includes(deviceKey(d))));
    } catch (error) {
        console.error("[studio-push] send failed", error instanceof Error ? error.message : error);
    }
}
