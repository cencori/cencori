"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useStudio } from "@/components/studio/StudioShell";

type State = "unsupported" | "needs-install" | "off" | "denied" | "on";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
    const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

/** iPhones and iPads only allow web notifications for apps added to the Home Screen. */
function isIosBrowser(): boolean {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return ios && !standalone;
}

/** Registers Studio's service worker once, on any page. */
export function useStudioServiceWorker() {
    useEffect(() => {
        if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/studio-sw.js").catch(() => undefined);
    }, []);
}

/**
 * The "Get notified" card: turns push notifications on for this device.
 * Hidden once they're on, or when the browser can't do them at all.
 */
export function StudioNotificationsCard() {
    const { project } = useStudio();
    const [state, setState] = useState<State>("unsupported");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            if (!VAPID_KEY) return setState("unsupported");
            if (isIosBrowser()) return setState("needs-install");
            if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
            if (Notification.permission === "denied") return setState("denied");
            const registration = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
            const subscription = await registration?.pushManager.getSubscription().catch(() => null);
            setState(subscription && Notification.permission === "granted" ? "on" : "off");
        })();
    }, []);

    const turnOn = async () => {
        setBusy(true);
        setError(null);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setState(permission === "denied" ? "denied" : "off");
                return;
            }
            const registration = await navigator.serviceWorker.register("/studio-sw.js");
            await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription()
                ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) });
            const response = await fetch("/api/studio/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: project.id, subscription: subscription.toJSON() }),
            });
            if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't turn notifications on.");
            setState("on");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't turn notifications on.");
        } finally {
            setBusy(false);
        }
    };

    if (state === "on" || state === "unsupported") return null;
    return (
        <section className="mt-4 flex gap-3 rounded-2xl border border-border/60 px-4 py-3.5">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">Never miss a customer</p>
                {state === "needs-install" ? (
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">To get notifications on iPhone, add Studio to your Home Screen: tap Share, then &ldquo;Add to Home Screen&rdquo;, and open it from there.</p>
                ) : state === "denied" ? (
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Notifications are blocked for Studio. Allow them in your browser&apos;s site settings to hear when someone needs you.</p>
                ) : (
                    <>
                        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Get a notification when a customer needs you, books or pays.</p>
                        <button type="button" onClick={() => void turnOn()} disabled={busy} className="mt-3 h-9 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">{busy ? "Turning on…" : "Turn on notifications"}</button>
                    </>
                )}
                {error && <p role="alert" className="mt-2 text-[13px] text-destructive">{error}</p>}
            </div>
        </section>
    );
}
