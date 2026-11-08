'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import DashboardCircleIcon from '@hugeicons/core-free-icons/DashboardCircleIcon';
import Analytics01Icon from '@hugeicons/core-free-icons/Analytics01Icon';
import Wallet01Icon from '@hugeicons/core-free-icons/Wallet01Icon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import { ArrowUpRight, Check, ChevronsUpDown, LayoutDashboard, LogOut } from 'lucide-react';
import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from '@/components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Logo } from '@/components/logo';
import { browserAuth } from '@/lib/auth/browser-auth';
import { adminHref } from '@/lib/admin/routing';
import { cn } from '@/lib/utils';

// The internal panel's shell, built from the same sidebar parts and account
// menu styling as the console (app/(app)/[orgSlug]/OrganizationLayoutClient.tsx,
// components/dashboard/UserMenu.tsx).

type Account = { userEmail: string; userName: string; userAvatar: string | null };

const NAV_ITEMS = [
    { href: '/', label: 'Overview', icon: DashboardCircleIcon, exact: true },
    { href: '/analytics', label: 'Analytics', icon: Analytics01Icon },
    { href: '/revenue', label: 'Revenue', icon: Wallet01Icon },
    { href: '/emails', label: 'Emails', icon: Mail01Icon },
    { href: '/feedback', label: 'Feedback', icon: BubbleChatIcon },
    { href: '/settings', label: 'Settings', icon: Settings02Icon },
];

const CONSOLE_URL = 'https://console.cencori.com/home';
const MENU_CLASS = 'w-66 rounded-xl !border-0 !bg-[#f3f3f1] dark:!bg-[#181818] p-1 shadow-[0_18px_48px_rgba(0,0,0,0.35)]';
const MENU_ITEM_CLASS = 'min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]';

async function signOut() {
    try {
        await browserAuth.signOut({ scope: 'local' });
    } finally {
        // The panel's layout shows its own sign-in form on the same page.
        window.location.assign(window.location.pathname);
    }
}

function AccountMenu({ userEmail, userName, userAvatar, side = 'top' }: Account & { side?: 'top' | 'bottom' }) {
    const display = userName || userEmail;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {side === 'top' ? (
                    <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        aria-label="Account menu"
                    >
                        <UserAvatar src={userAvatar} name={userName} email={userEmail} size={24} />
                        <span className="flex-1 truncate">{display}</span>
                        <span className="inline-flex size-6 items-center justify-center rounded-full border border-border/60 text-xs font-bold leading-none text-muted-foreground">⋯</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border transition-colors hover:bg-secondary"
                        aria-label="Account menu"
                    >
                        <UserAvatar src={userAvatar} name={userName} email={userEmail} size={28} className="border-0" />
                    </button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className={MENU_CLASS} side={side} sideOffset={4} align={side === 'top' ? 'start' : 'end'}>
                <div className="space-y-0 px-3 pb-1.5 pt-1.5">
                    <p className="truncate text-[13px] font-medium leading-tight text-popover-foreground">{display}</p>
                    {userName && <p className="truncate text-[11px] leading-tight text-muted-foreground">{userEmail}</p>}
                </div>
                <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                <div className="flex min-h-8 items-center justify-between px-3 py-1">
                    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Theme</p>
                    <ThemeSwitcher />
                </div>
                <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
                    <a href={CONSOLE_URL}>
                        <span className="min-w-0 flex-1 truncate">Live Console</span>
                        <LayoutDashboard className="ml-auto size-4 shrink-0" />
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
                    <a href="https://cencori.com">
                        <span className="min-w-0 flex-1 truncate">Homepage</span>
                        <span className="size-3.5 shrink-0">
                            <Logo variant="mark" className="h-full w-full" />
                        </span>
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className={cn(MENU_ITEM_CLASS, 'text-red-500 focus:text-red-500')}
                    onClick={() => void signOut()}
                >
                    <span className="min-w-0 flex-1 truncate">Log out</span>
                    <LogOut className="ml-auto size-4 shrink-0" />
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Brand() {
    return <span className="truncate text-sm font-medium">Admin Console</span>;
}

/** Header switcher, like the console's project switcher: Admin here, Console a click away. */
function WorkspaceSwitcher() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-foreground hover:bg-sidebar-accent"
                    aria-label="Switch workspace"
                >
                    <span className="min-w-0 flex-1 truncate">Admin Console</span>
                    <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/60" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className={MENU_CLASS} side="bottom" sideOffset={4} align="start">
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={(event) => event.preventDefault()}>
                    <span className="min-w-0 flex-1 truncate font-medium">Admin Console</span>
                    <Check className="ml-auto size-4 shrink-0" />
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
                    <a href={CONSOLE_URL}>
                        <span className="min-w-0 flex-1 truncate">Live Console</span>
                        <ArrowUpRight className="ml-auto size-4 shrink-0" />
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function NavMenu({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    return (
        <SidebarMenu>
            {NAV_ITEMS.map((item) => {
                // Clean paths on admin.cencori.com, /internal/… elsewhere.
                const href = adminHref(pathname, item.href);
                const isActive = item.exact
                    ? pathname === href
                    : pathname === href || pathname.startsWith(`${href}/`);
                return (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive} size="sm" tooltip={item.label}>
                            <Link href={href} onClick={onNavigate}>
                                <HugeiconsIcon icon={item.icon} className="!h-5 !w-5" />
                                <span className="text-sm">{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    );
}

export function InternalShell({
    children,
    userEmail,
    userName,
    userAvatar,
}: {
    children: React.ReactNode;
} & Account) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const account = { userEmail, userName, userAvatar };
    const home = adminHref(pathname, '/');

    return (
        <ReactQueryProvider>
            <SidebarProvider defaultOpen className="min-h-screen">
                {/* Desktop sidebar */}
                <Sidebar
                    collapsible="none"
                    className="sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border/70 bg-sidebar md:flex"
                >
                    <SidebarHeader className="h-12 shrink-0 justify-center p-1.5">
                        <WorkspaceSwitcher />
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarGroup className="pt-3">
                            <NavMenu pathname={pathname} />
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter className="space-y-0.5 pt-1">
                        <AccountMenu {...account} />
                    </SidebarFooter>
                </Sidebar>

                {/* Phone top bar */}
                <div className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-border/40 bg-background/95 px-3 backdrop-blur-sm md:hidden">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="rounded-md p-2 text-muted-foreground hover:bg-muted/50"
                            aria-label="Open menu"
                        >
                            <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" strokeWidth={1.6} />
                        </button>
                        <Link href={home}><Brand /></Link>
                    </div>
                    <AccountMenu {...account} side="bottom" />
                </div>

                {/* Phone menu */}
                {mobileOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                        <aside className="absolute bottom-0 left-0 top-0 flex w-64 flex-col border-r border-sidebar-border/70 bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
                            <div className="flex h-12 items-center justify-between gap-2 px-1.5">
                                <WorkspaceSwitcher />
                                <button
                                    onClick={() => setMobileOpen(false)}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50"
                                    aria-label="Close menu"
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" strokeWidth={1.6} />
                                </button>
                            </div>
                            <div className="flex-1 px-2 pt-3">
                                <NavMenu pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                            </div>
                        </aside>
                    </div>
                )}

                <main className="min-h-screen min-w-0 flex-1 overflow-y-auto pt-12 md:pt-0">
                    {children}
                </main>
            </SidebarProvider>
        </ReactQueryProvider>
    );
}
