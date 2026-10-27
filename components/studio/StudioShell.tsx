"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon } from "@solar-icons/react/bold-duotone/home";
import { ChatRoundLineIcon } from "@solar-icons/react/bold-duotone/chat-round-line";
import { Bag4Icon } from "@solar-icons/react/bold-duotone/bag-4";
import { WalletIcon } from "@solar-icons/react/bold-duotone/wallet";
import { StarsMinimalisticIcon } from "@solar-icons/react/bold-duotone/stars-minimalistic";
import { ReactQueryProvider } from "@/lib/providers/ReactQueryProvider";
import { ThemeScope } from "@/components/theme-scope";
import { cn } from "@/lib/utils";
import { StudioAskBar, StudioCopilotProvider } from "@/components/studio/StudioCopilot";
import { useStudioServiceWorker } from "@/components/studio/StudioNotifications";
import { useUnreadCount } from "@/components/studio/useInbox";

export interface StudioContextValue {
    user: { id: string; firstName: string | null; fullName: string | null; email: string | null; avatarUrl: string | null };
    organization: { id: string; name: string; slug: string; isBusiness: boolean };
    organizations: Array<{ id: string; name: string }>;
    project: { id: string; name: string; slug: string };
    agents: Array<{ id: string; name: string; live: boolean }>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

/** The business Studio is showing, its project and its assistants. */
export function useStudio(): StudioContextValue {
    const value = useContext(StudioContext);
    if (!value) throw new Error("useStudio must be used inside Studio");
    return value;
}

const TABS = [
    { href: "/", label: "Home", icon: HomeIcon, match: (path: string) => path === "/" },
    { href: "/inbox", label: "Inbox", icon: ChatRoundLineIcon, match: (path: string) => path.startsWith("/inbox") },
    { href: "/sales", label: "Sales", icon: Bag4Icon, match: (path: string) => path.startsWith("/sales") },
    { href: "/money", label: "Money", icon: WalletIcon, match: (path: string) => path.startsWith("/money") },
    { href: "/assistant", label: "AI", icon: StarsMinimalisticIcon, match: (path: string) => path.startsWith("/assistant") },
];

/**
 * Studio's frame: one phone-width column, and the pill of tabs at the bottom
 * (the console's pill, with labels). On a laptop it's the same column,
 * centred.
 */
export function StudioShell({ workspace, children }: { workspace: StudioContextValue; children: ReactNode }) {
    // Studio is served at the subdomain's root; the internal prefix never shows.
    // Installable app and push notifications.
    useStudioServiceWorker();
    const pathname = (usePathname() ?? "/").replace(/^\/studio-app(?=\/|$)/, "") || "/";
    // A conversation, setup and getting the app take the whole screen: their own controls, no tabs.
    const focused = /^\/inbox\/[^/]+/.test(pathname) || pathname.startsWith("/setup") || pathname.startsWith("/get-app");
    return (
        <ReactQueryProvider>
            <StudioContext.Provider value={workspace}>
                <StudioCopilotProvider workspace={workspace}>
                <ThemeScope name="dashboard-theme" />
                <div className="min-h-svh bg-background font-sans text-foreground">
                    {/* Room at the bottom for the ask bar and the tabs. */}
                    <main className={cn("mx-auto w-full max-w-md", focused ? "" : "px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]")}>
                        {children}
                    </main>
                    {!focused && <nav
                        aria-label="Studio"
                        className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit items-center gap-3 rounded-full border border-border/60 bg-background/90 p-1 backdrop-blur-md"
                    >
                        {TABS.map((tab) => {
                            const active = tab.match(pathname);
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border text-[9px] font-medium transition-colors",
                                        active ? "border-border text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <span className="relative">
                                        <tab.icon size={18} />
                                        {tab.href === "/inbox" && <UnreadBadge />}
                                    </span>
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </nav>}
                    {!focused && <StudioAskBar />}
                </div>
                </StudioCopilotProvider>
            </StudioContext.Provider>
        </ReactQueryProvider>
    );
}

/** The number of unread chats, on the Inbox tab. */
function UnreadBadge() {
    const count = useUnreadCount();
    if (count === 0) return null;
    return (
        <span aria-label={`${count} unread`} className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-semibold leading-none text-white">
            {count > 9 ? "9+" : count}
        </span>
    );
}
