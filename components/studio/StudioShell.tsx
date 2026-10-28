"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { StudioLink, useStudioPath } from "@/components/studio/studio-nav";
import { HomeIcon } from "@solar-icons/react/bold-duotone/home";
import { ChatRoundLineIcon } from "@solar-icons/react/bold-duotone/chat-round-line";
import { Bag4Icon } from "@solar-icons/react/bold-duotone/bag-4";
import { WalletIcon } from "@solar-icons/react/bold-duotone/wallet";
import { StarsMinimalisticIcon } from "@solar-icons/react/bold-duotone/stars-minimalistic";
import { StudioDataProvider, StudioOfflineStrip } from "@/components/studio/studio-data";
import { ThemeScope } from "@/components/theme-scope";
import { cn } from "@/lib/utils";
import { StudioAskBar, StudioCopilotProvider, useStudioCopilot } from "@/components/studio/StudioCopilot";
import { HugeiconsIcon } from "@hugeicons/react";
import AirdropIcon from "@hugeicons/core-free-icons/AirdropIcon";
import { StudioTasksProvider } from "@/components/studio/StudioTasks";
import { useStudioServiceWorker } from "@/components/studio/StudioNotifications";
import { useKeyboardInset } from "@/components/studio/use-keyboard-inset";
import { useUnreadCount } from "@/components/studio/useInbox";
import { StudioProfile, switchStudioBusiness } from "@/components/studio/StudioProfile";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

export interface StudioContextValue {
    user: { id: string; firstName: string | null; fullName: string | null; email: string | null; avatarUrl: string | null };
    organization: { id: string; name: string; slug: string; isBusiness: boolean };
    organizations: Array<{ id: string; name: string; isBusiness: boolean }>;
    project: { id: string; name: string; slug: string };
    agents: Array<{ id: string; name: string; live: boolean; published: boolean }>;
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
 * Studio's frame. Phones: one column, and the pill of tabs at the bottom (the
 * console's pill, with labels) with Copilot beside it. Desktop (lg and up):
 * the same tabs and Copilot down a sidebar on the left, and a wider column
 * beside it.
 */
export function StudioShell({ workspace, children }: { workspace: StudioContextValue; children: ReactNode }) {
    // Studio is served at the subdomain's root; the internal prefix never shows.
    // Installable app and push notifications.
    useStudioServiceWorker();
    useKeyboardInset();
    const pathname = useStudioPath();
    // A conversation, setup and getting the app take the whole screen: their own controls, no tabs.
    const focused = /^\/(inbox|assistant)\/[^/]+/.test(pathname) || pathname.startsWith("/setup") || pathname.startsWith("/get-app");
    return (
        <StudioDataProvider>
            <StudioContext.Provider value={workspace}>
                <StudioTasksProvider>
                <StudioCopilotProvider workspace={workspace}>
                <ThemeScope name="dashboard-theme" />
                <div className="min-h-svh bg-background font-sans text-foreground">
                    <StudioOfflineStrip />
                    {!focused && <StudioSidebar pathname={pathname} />}
                    {/* Room at the bottom for the tabs and the Copilot button; on desktop, beside the sidebar. */}
                    <div className={focused ? undefined : "lg:pl-60"}>
                    <main className={cn("mx-auto w-full max-w-md", focused ? "" : "px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] lg:max-w-3xl lg:px-10 lg:pb-12 lg:pt-10")}>
                        {children}
                    </main>
                    </div>
                    {/* The tabs, and Copilot beside them (phones; the sidebar has them on desktop). */}
                    {!focused && <div className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit items-center gap-2 lg:hidden">
                    <nav
                        aria-label="Studio"
                        className="flex items-center gap-3 rounded-full border border-border/60 bg-background/90 p-1 backdrop-blur-md"
                    >
                        {TABS.map((tab) => {
                            const active = tab.match(pathname);
                            return (
                                <StudioLink
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
                                </StudioLink>
                            );
                        })}
                    </nav>
                    <StudioAskBar />
                    </div>}
                </div>
                </StudioCopilotProvider>
                </StudioTasksProvider>
            </StudioContext.Provider>
        </StudioDataProvider>
    );
}

/** Desktop only: the business at the top, then the tabs and Copilot, and you at the foot. */
function StudioSidebar({ pathname }: { pathname: string }) {
    const { ask } = useStudioCopilot();
    // Sheets and banners centre over the column beside it (lg only, while it's showing).
    useEffect(() => {
        document.documentElement.style.setProperty("--studio-sidebar", "15rem");
        return () => { document.documentElement.style.removeProperty("--studio-sidebar"); };
    }, []);
    return (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/60 bg-background px-3 py-6 lg:flex">
            <BusinessSwitcher />
            <nav aria-label="Studio" className="mt-4 flex flex-col gap-1">
                {TABS.map((tab) => {
                    const active = tab.match(pathname);
                    return (
                        <StudioLink
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                // The console sidebar's style: a soft filled block on the current tab.
                                "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                                active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                            )}
                        >
                            <span className="relative">
                                <tab.icon size={18} />
                                {tab.href === "/inbox" && <UnreadBadge />}
                            </span>
                            {tab.label}
                        </StudioLink>
                    );
                })}
                {/* Copilot opens its sheet; it isn't a page, so it's never the current item. */}
                <button
                    type="button"
                    onClick={() => ask()}
                    className="flex h-9 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
                >
                    <HugeiconsIcon icon={AirdropIcon} aria-hidden className="size-[18px]" />
                    Copilot
                </button>
            </nav>
            {/* You: the profile sheet, from your photo and full name. */}
            <div className="mt-auto">
                <StudioProfile variant="row" />
            </div>
        </aside>
    );
}

/** The business name at the top of the sidebar, opening a menu of your businesses. */
function BusinessSwitcher() {
    const { organization, organizations } = useStudio();
    const tasks = useStudioTasks();
    const [switching, setSwitching] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const choose = async (id: string) => {
        if (id === organization.id) return;
        setSwitching(id);
        setError(null);
        try {
            await switchStudioBusiness(id);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't switch business.");
            setSwitching(null);
        }
    };
    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="flex h-7 w-full items-center gap-2 rounded-md px-3 text-left transition-colors hover:bg-sidebar-accent/60">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{organization.name}</span>
                        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="bottom"
                    align="start"
                    sideOffset={5}
                    className="dashboard-theme z-[70] w-56 rounded-xl !border-0 !bg-[#f3f3f1] p-1 font-sans shadow-[0_18px_48px_rgba(0,0,0,0.35)] data-[state=closed]:!animate-none data-[state=open]:!animate-none dark:!bg-[#181818]"
                >
                    <p className="px-3 pb-1 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Businesses</p>
                    <div className="max-h-60 overflow-y-auto">
                        {organizations.map((item) => (
                            <DropdownMenuItem
                                key={item.id}
                                disabled={switching !== null}
                                onSelect={() => void choose(item.id)}
                                className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px] font-medium"
                            >
                                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                {switching === item.id
                                    ? <span className="ml-auto text-xs text-muted-foreground">Opening…</span>
                                    : item.id === organization.id && <Check className="ml-auto size-4 shrink-0" />}
                            </DropdownMenuItem>
                        ))}
                    </div>
                    <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                    <DropdownMenuItem onSelect={() => tasks.open("newbusiness")} className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]">
                        <span className="min-w-0 flex-1 truncate">New business</span>
                        <Plus className="ml-auto size-4 shrink-0" />
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {error && <p role="alert" className="mt-1 px-3 text-xs text-destructive">{error}</p>}
        </div>
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
