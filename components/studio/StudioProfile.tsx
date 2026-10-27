"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import posthog from "posthog-js";
import { useTheme } from "next-themes";
import { BellIcon } from "@solar-icons/react/bold-duotone/bell";
import { SmartphoneIcon } from "@solar-icons/react/bold-duotone/smartphone";
import { MonitorIcon } from "@solar-icons/react/bold-duotone/monitor";
import { QuestionCircleIcon } from "@solar-icons/react/bold-duotone/question-circle";
import { Logout2Icon } from "@solar-icons/react/bold-duotone/logout-2";
import { Shop2Icon } from "@solar-icons/react/bold-duotone/shop-2";
import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { CheckCircleIcon } from "@solar-icons/react/bold-duotone/check-circle";
import { CameraIcon } from "@solar-icons/react/bold-duotone/camera";
import { PaletteIcon } from "@solar-icons/react/bold-duotone/palette";
import { SunIcon } from "@solar-icons/react/bold-duotone/sun";
import { MoonIcon } from "@solar-icons/react/bold-duotone/moon";
import { MonitorSmartphoneIcon } from "@solar-icons/react/bold-duotone/monitor-smartphone";
import type { Icon } from "@solar-icons/react/lib/types";
import { browserAuth } from "@/lib/auth/browser-auth";
import { beginIntentionalSignOut, clearClientSessionCaches } from "@/lib/auth/session-caches";
import { getConsoleOriginForHostname } from "@/lib/console/routing";
import { useStudio } from "@/components/studio/StudioShell";
import { useStudioPush } from "@/components/studio/StudioNotifications";
import { initials } from "@/components/studio/useInbox";
import { cn } from "@/lib/utils";

/**
 * A phone photo, shrunk on the device to a 512px square JPEG: camera photos
 * are far over the upload limit (2MB), and an avatar never shows that big.
 */
async function squareJpeg(file: File, size = 512): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, side);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't read that photo.");
    // The middle of the photo, cropped to a square.
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that photo."))), "image/jpeg", 0.88));
}

function Avatar({ url, name, className }: { url: string | null; name: string; className?: string }) {
    const [broken, setBroken] = useState(false);
    return (
        <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-foreground", className)}>
            {url && !broken
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
                : initials(name)}
        </span>
    );
}

/** One row of a group: icon, label, and what sits on the right. */
function Row({ icon: RowIcon, label, right, href, external, onClick, disabled }: {
    icon: Icon;
    label: string;
    right?: ReactNode;
    href?: string;
    external?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}) {
    const inner = (
        <>
            <RowIcon size={20} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[15px]">{label}</span>
            {right ?? ((href || onClick) && <AltArrowRightIcon size={16} className="shrink-0 text-muted-foreground" />)}
        </>
    );
    const className = "flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60";
    if (href && external) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>;
    if (href) return <Link href={href} className={className}>{inner}</Link>;
    if (onClick) return <button type="button" onClick={onClick} disabled={disabled} className={className}>{inner}</button>;
    return <div className={className}>{inner}</div>;
}

const THEMES = [
    { id: "light", label: "Light", icon: SunIcon },
    { id: "dark", label: "Dark", icon: MoonIcon },
    { id: "system", label: "System", icon: MonitorSmartphoneIcon },
] as const;

function Group({ title, children }: { title?: string; children: ReactNode }) {
    return (
        <section className="mt-5">
            {title && <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">{title}</p>}
            <div className="divide-y divide-border/40 overflow-hidden rounded-2xl bg-muted/60">{children}</div>
        </section>
    );
}

/**
 * The avatar beside the home greeting, and the sheet it opens: who's
 * signed in, which business, this device's settings, help, and sign out.
 */
export function StudioProfile({ className }: { className?: string }) {
    const { user, organization, organizations } = useStudio();
    const push = useStudioPush();
    const [open, setOpen] = useState(false);
    // The sheet's screens: the profile itself, or one setting opened from it.
    const [screen, setScreen] = useState<"profile" | "theme">("profile");
    const { theme = "system", setTheme } = useTheme();
    const [installed, setInstalled] = useState(true);
    const [consoleUrl, setConsoleUrl] = useState("https://console.cencori.com");
    const [switching, setSwitching] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
    const [uploading, setUploading] = useState(false);
    const photoInput = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const name = user.fullName || user.firstName || user.email || "You";

    const uploadPhoto = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append("file", new File([await squareJpeg(file)], "avatar.jpg", { type: "image/jpeg" }));
            const response = await fetch("/api/user/avatar", { method: "POST", body: form });
            const payload = await response.json().catch(() => null) as { avatar_url?: string; error?: string } | null;
            if (!response.ok || !payload?.avatar_url) throw new Error(payload?.error ?? "Couldn't change your photo.");
            setAvatarUrl(payload.avatar_url);
            // The home greeting's avatar reads it from the workspace.
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't change your photo.");
        } finally {
            setUploading(false);
            if (photoInput.current) photoInput.current.value = "";
        }
    };

    useEffect(() => {
        setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
        const origin = getConsoleOriginForHostname(window.location.host.replace(/^studio\./, ""));
        if (origin) setConsoleUrl(origin);
    }, []);

    const switchTo = async (organizationId: string) => {
        if (organizationId === organization.id) return;
        setSwitching(organizationId);
        setError(null);
        try {
            const response = await fetch("/api/studio/workspace", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organization_id: organizationId }),
            });
            if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't switch business.");
            // A full load: every tab's data belongs to the old business.
            window.location.assign("/");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't switch business.");
            setSwitching(null);
        }
    };

    const signOut = async () => {
        setSigningOut(true);
        beginIntentionalSignOut();
        clearClientSessionCaches();
        await browserAuth.signOut({ scope: "local" }).catch(() => undefined);
        posthog.reset();
        window.location.assign("/login");
    };

    const notifications = push.state === "on" ? <span className="text-sm text-muted-foreground">On</span>
        : push.state === "denied" ? <span className="text-sm text-muted-foreground">Blocked</span>
        : push.state === "needs-install" ? <span className="text-sm text-muted-foreground">Install first</span>
        : <span className="text-sm font-semibold">{push.busy ? "Turning on…" : "Turn on"}</span>;

    return (
        <Drawer.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setScreen("profile"); }}>
            <Drawer.Trigger asChild>
                <button
                    type="button"
                    aria-label="Your profile"
                    className={cn("shrink-0 rounded-full border border-border/60 p-0.5", className)}
                >
                    <Avatar key={avatarUrl ?? "none"} url={avatarUrl} name={name} className="size-full text-xs" />
                </button>
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
                <Drawer.Content className="dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92svh] max-w-md flex-col rounded-t-3xl border-t border-border/60 bg-background font-sans text-foreground outline-none">
                    <Drawer.Title className="sr-only">Your profile</Drawer.Title>
                    <Drawer.Description className="sr-only">Your account, your business and this device&apos;s settings.</Drawer.Description>
                    <div className="flex justify-center pt-3">
                        <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                    </div>
                    {screen === "theme" ? (
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                        <div className="relative flex items-center justify-center pt-3">
                            <button type="button" onClick={() => setScreen("profile")} aria-label="Back" className="absolute left-0 flex size-9 items-center justify-center rounded-full border border-border/60">
                                <AltArrowLeftIcon size={16} />
                            </button>
                            <p className="text-[15px] font-semibold">Theme</p>
                        </div>
                        <Group>
                            {THEMES.map((item) => (
                                <Row
                                    key={item.id}
                                    icon={item.icon}
                                    label={item.label}
                                    onClick={() => setTheme(item.id)}
                                    right={theme === item.id ? <CheckCircleIcon size={20} className="shrink-0" /> : <span />}
                                />
                            ))}
                        </Group>
                        <p className="mt-2 px-1 text-xs leading-5 text-muted-foreground">System follows your phone&apos;s light or dark setting.</p>
                    </div>
                    ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                        <div className="flex flex-col items-center pt-4 text-center">
                            <button
                                type="button"
                                onClick={() => photoInput.current?.click()}
                                disabled={uploading}
                                aria-label="Change your photo"
                                className="relative"
                            >
                                <Avatar key={avatarUrl ?? "none"} url={avatarUrl} name={name} className={cn("size-20 text-xl", uploading && "opacity-50")} />
                                <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-background bg-foreground text-background">
                                    <CameraIcon size={14} />
                                </span>
                            </button>
                            <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
                            <p className="mt-3 text-lg font-semibold">{name}</p>
                            {user.email && user.email !== name && <p className="text-sm text-muted-foreground">{user.email}</p>}
                        </div>

                        <Group title={organizations.length > 1 ? "Your businesses" : "Your business"}>
                            {organizations.length > 1 ? organizations.map((item) => (
                                <Row
                                    key={item.id}
                                    icon={Shop2Icon}
                                    label={item.name}
                                    onClick={() => void switchTo(item.id)}
                                    disabled={switching !== null}
                                    right={item.id === organization.id
                                        ? <CheckCircleIcon size={20} className="shrink-0" />
                                        : switching === item.id ? <span className="text-sm text-muted-foreground">Opening…</span> : <span />}
                                />
                            )) : <Row icon={Shop2Icon} label={organization.name} />}
                        </Group>

                        <Group title="Settings">
                            <Row
                                icon={PaletteIcon}
                                label="Theme"
                                onClick={() => setScreen("theme")}
                                right={(
                                    <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                                        {THEMES.find((item) => item.id === theme)?.label ?? "System"}
                                        <AltArrowRightIcon size={16} />
                                    </span>
                                )}
                            />
                            {push.state !== "unsupported" && (
                                <Row
                                    icon={BellIcon}
                                    label="Notifications"
                                    right={notifications}
                                    onClick={push.state === "off" ? () => void push.turnOn() : undefined}
                                    disabled={push.busy}
                                />
                            )}
                            {!installed && <Row icon={SmartphoneIcon} label="Get the app" href="/get-app" />}
                            <Row icon={MonitorIcon} label="Open the full console" href={consoleUrl} external />
                        </Group>
                        {push.error && <p role="alert" className="mt-2 px-1 text-[13px] text-destructive">{push.error}</p>}

                        <Group>
                            <Row icon={QuestionCircleIcon} label="Help & feedback" href="mailto:support@cencori.com" external />
                        </Group>

                        {error && <p role="alert" className="mt-3 px-1 text-[13px] text-destructive">{error}</p>}

                        <button
                            type="button"
                            onClick={() => void signOut()}
                            disabled={signingOut}
                            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border/60 text-[15px] font-semibold text-red-500 disabled:opacity-60"
                        >
                            <Logout2Icon size={18} />
                            {signingOut ? "Signing out…" : "Sign out"}
                        </button>
                    </div>
                    )}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
