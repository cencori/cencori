"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle, Sparkles } from "lucide-react";
import { ReactQueryProvider } from "@/lib/providers/ReactQueryProvider";
import { ThemeScope } from "@/components/theme-scope";
import { cn } from "@/lib/utils";
import { StudioAskBar, StudioCopilotProvider } from "@/components/studio/StudioCopilot";

export interface StudioContextValue {
    user: { id: string; firstName: string | null; email: string | null };
    organization: { id: string; name: string; slug: string; isBusiness: boolean };
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

// Sales and Money join in the next phase.
const TABS = [
    { href: "/", label: "Home", icon: House, match: (path: string) => path === "/" },
    { href: "/inbox", label: "Inbox", icon: MessageCircle, match: (path: string) => path.startsWith("/inbox") },
    { href: "/assistant", label: "Assistant", icon: Sparkles, match: (path: string) => path.startsWith("/assistant") },
];

/**
 * Studio's frame: one phone-width column, and the pill of tabs at the bottom
 * (the console's pill, with labels). On a laptop it's the same column,
 * centred.
 */
export function StudioShell({ workspace, children }: { workspace: StudioContextValue; children: ReactNode }) {
    // Studio is served at the subdomain's root; the internal prefix never shows.
    const pathname = (usePathname() ?? "/").replace(/^\/studio-app(?=\/|$)/, "") || "/";
    // A conversation and setup take the whole screen: their own controls, no tabs.
    const focused = /^\/inbox\/[^/]+/.test(pathname) || pathname.startsWith("/setup");
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
                        className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto grid w-[calc(100%-2rem)] max-w-sm grid-cols-3 gap-1 rounded-full border border-border/60 bg-background/90 p-1.5 backdrop-blur-md"
                    >
                        {TABS.map((tab) => {
                            const active = tab.match(pathname);
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "flex h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors",
                                        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <tab.icon className="h-5 w-5" strokeWidth={1.8} />
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
