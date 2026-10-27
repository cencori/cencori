"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { useStudio } from "@/components/studio/StudioShell";

/**
 * "Get the app", right after signing up: Studio added to the Home Screen
 * before setup starts, so it opens like an app and (on iPhone) can send
 * notifications at all. Android installs in one tap; iPhone needs Share →
 * Add to Home Screen, shown step by step; in-app browsers (Instagram,
 * Facebook…) can't install, so they're sent to the real browser first.
 * Already installed, or on a computer, it goes straight to setup.
 */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "in-app-ios" | "in-app-android" | "other";

// Chrome fires this once, often before the page has rendered: keep it from the moment this code loads.
let deferredPrompt: InstallPrompt | null = null;
const promptListeners = new Set<() => void>();
if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event as InstallPrompt;
        promptListeners.forEach((listener) => listener());
    });
}

function detect(): { platform: Platform; installed: boolean } {
    const ua = navigator.userAgent;
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const android = /android/i.test(ua);
    const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|Snapchat|Twitter|; wv\)/i.test(ua);
    const platform: Platform = ios ? (inApp ? "in-app-ios" : "ios") : android ? (inApp ? "in-app-android" : "android") : "other";
    return { platform, installed };
}

function ShareIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="inline -mt-1">
            <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
    );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
    return (
        <li className="flex gap-3.5 px-4 py-3.5 [&+&]:border-t [&+&]:border-border/60">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-semibold text-background">{n}</span>
            <span className="pt-0.5 text-[15px] leading-6">{children}</span>
        </li>
    );
}

export default function StudioGetAppPage() {
    const { organization } = useStudio();
    const router = useRouter();
    const [device, setDevice] = useState<{ platform: Platform; installed: boolean } | null>(null);
    const [canPrompt, setCanPrompt] = useState(false);
    const [installedNow, setInstalledNow] = useState(false);

    useEffect(() => {
        const found = detect();
        // In the app already, or on a computer (the laptop dashboard comes later): on to setup.
        if (found.installed || found.platform === "other") {
            router.replace("/setup");
            return;
        }
        setDevice(found);
        const sync = () => setCanPrompt(!!deferredPrompt);
        sync();
        promptListeners.add(sync);
        const installed = () => setInstalledNow(true);
        window.addEventListener("appinstalled", installed);
        return () => {
            promptListeners.delete(sync);
            window.removeEventListener("appinstalled", installed);
        };
    }, [router]);

    const install = async () => {
        const prompt = deferredPrompt;
        if (!prompt) return;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        deferredPrompt = null;
        setCanPrompt(false);
        if (outcome === "accepted") setInstalledNow(true);
    };

    if (!device) return <div className="min-h-svh" />;

    const here = typeof window === "undefined" ? "" : window.location.href;
    const chromeIntent = `intent://${here.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(here)};end`;

    return (
        <div className="flex min-h-svh flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
            <div className="mt-6 flex flex-col items-center text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/studio/icon-192.png" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-[22px] shadow-sm" />
                <p className="mt-5 text-sm text-muted-foreground">Welcome to Studio by Cencori</p>
                <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">
                    {installedNow ? "Studio is on your phone" : "Get the app to begin"}
                </h1>
                <p className="mt-2 max-w-xs text-[15px] leading-6 text-muted-foreground">
                    {installedNow
                        ? "Open Studio from your home screen to set up your assistant."
                        : `Run ${organization.name} from your home screen, and hear the moment a customer needs you.`}
                </p>
            </div>

            {installedNow ? (
                <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Check className="h-8 w-8" strokeWidth={2.4} />
                </div>
            ) : device.platform === "android" ? (
                canPrompt ? (
                    <button type="button" onClick={() => void install()} className="mt-8 h-[52px] w-full rounded-full bg-foreground text-base font-semibold text-background">Get the app</button>
                ) : (
                    <ol className="mt-8 overflow-hidden rounded-2xl border border-border/60">
                        <Step n={1}>Tap your browser&apos;s menu <span className="font-semibold">⋮</span> at the top right</Step>
                        <Step n={2}>Choose <span className="font-semibold">Add to Home screen</span> or <span className="font-semibold">Install app</span></Step>
                        <Step n={3}>Open <span className="font-semibold">Studio</span> from your home screen</Step>
                    </ol>
                )
            ) : device.platform === "ios" ? (
                <ol className="mt-8 overflow-hidden rounded-2xl border border-border/60">
                    <Step n={1}>Tap <span className="font-semibold">Share</span> <ShareIcon /> in Safari. Don&apos;t see it? Tap <span className="font-semibold">⋯</span> first.</Step>
                    <Step n={2}>Scroll down and tap <span className="font-semibold">Add to Home Screen</span> <Plus className="inline -mt-1 h-[18px] w-[18px] rounded border border-current p-px" /></Step>
                    <Step n={3}>Tap <span className="font-semibold">Add</span>, then open <span className="font-semibold">Studio</span> from your home screen</Step>
                </ol>
            ) : device.platform === "in-app-android" ? (
                <div className="mt-8">
                    <p className="text-center text-[15px] leading-6 text-muted-foreground">This page opened inside another app, which can&apos;t install Studio. Open it in Chrome to continue.</p>
                    <a href={chromeIntent} className="mt-4 flex h-[52px] w-full items-center justify-center rounded-full bg-foreground text-base font-semibold text-background">Open in Chrome</a>
                </div>
            ) : (
                <ol className="mt-8 overflow-hidden rounded-2xl border border-border/60">
                    <Step n={1}>This page opened inside another app. Tap <span className="font-semibold">⋯</span> or the compass at the corner</Step>
                    <Step n={2}>Choose <span className="font-semibold">Open in Safari</span> (or Open in browser)</Step>
                    <Step n={3}>In Safari, tap <span className="font-semibold">Share</span> <ShareIcon />, then <span className="font-semibold">Add to Home Screen</span></Step>
                </ol>
            )}

            <div className="mt-auto pt-8 text-center">
                <Link href="/setup" className="inline-block py-2 text-sm text-muted-foreground underline-offset-2 hover:underline">Continue in the browser for now</Link>
            </div>
        </div>
    );
}
