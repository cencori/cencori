'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';
import { HugeiconsIcon } from '@hugeicons/react';
import DashboardCircleIcon from '@hugeicons/core-free-icons/DashboardCircleIcon';
import CheckListIcon from '@hugeicons/core-free-icons/CheckListIcon';
import Analytics01Icon from '@hugeicons/core-free-icons/Analytics01Icon';
import Activity01Icon from '@hugeicons/core-free-icons/Activity01Icon';
import ChartUpIcon from '@hugeicons/core-free-icons/ChartUpIcon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Wallet01Icon from '@hugeicons/core-free-icons/Wallet01Icon';
import ArrowDataTransferHorizontalIcon from '@hugeicons/core-free-icons/ArrowDataTransferHorizontalIcon';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';

type Account = { userEmail: string; userName: string; userAvatar: string | null };

const NAV_ITEMS = [
    { href: '/internal', label: 'Overview', icon: DashboardCircleIcon, exact: true },
    { href: '/internal/tasks', label: 'Tasks', icon: CheckListIcon },
    { href: '/internal/analytics', label: 'Analytics', icon: Analytics01Icon },
    { href: '/internal/revenue', label: 'Revenue', icon: Wallet01Icon },
    { href: '/internal/events', label: 'Events', icon: Activity01Icon },
    { href: '/internal/kpi', label: 'KPIs', icon: ChartUpIcon },
    { href: '/internal/emails', label: 'Emails', icon: Mail01Icon },
    { href: '/internal/model-mappings', label: 'Mappings', icon: ArrowDataTransferHorizontalIcon },
    { href: '/internal/feedback', label: 'Feedback', icon: BubbleChatIcon },
    { href: '/internal/settings', label: 'Settings', icon: Settings02Icon },
];

function AccountBadge({ userEmail, userName, userAvatar, size = 28 }: Account & { size?: number }) {
    return (
        <span className="flex min-w-0 items-center gap-2.5">
            <UserAvatar src={userAvatar} name={userName} email={userEmail} size={size} />
            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">{userName || userEmail}</span>
                {userName ? (
                    <span className="block truncate text-[11px] leading-tight text-muted-foreground">{userEmail}</span>
                ) : null}
            </span>
        </span>
    );
}

function NavContent({ pathname, account, onNavigate }: { pathname: string; account: Account; onNavigate?: () => void }) {
    return (
        <>
            {/* Signed-in user */}
            <div className="px-4 py-4 border-b border-border/30">
                <Link href="/internal" className="block" onClick={onNavigate}>
                    <AccountBadge {...account} />
                </Link>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                                isActive
                                    ? "bg-secondary text-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            )}
                        >
                            <HugeiconsIcon icon={item.icon} className="h-4 w-4" strokeWidth={1.6} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-3 border-t border-border/30">
                <form action="/api/auth/signout" method="POST">
                    <button
                        type="submit"
                        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                        <HugeiconsIcon icon={Logout01Icon} className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Sign out
                    </button>
                </form>
            </div>
        </>
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
    const account = { userEmail, userName, userAvatar };
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <ReactQueryProvider>
            <div className="min-h-screen bg-background flex">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex w-56 shrink-0 border-r border-border/40 bg-card/30 flex-col sticky top-0 h-screen">
                    <NavContent pathname={pathname} account={account} />
                </aside>

                {/* Mobile Top Bar */}
                <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-background/95 backdrop-blur-sm border-b border-border/30 flex items-center justify-between px-4">
                    <Link href="/internal" className="flex min-w-0 items-center gap-2">
                        <UserAvatar src={userAvatar} name={userName} email={userEmail} size={24} />
                        <span className="truncate text-sm font-semibold">{userName || userEmail}</span>
                    </Link>
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
                    >
                        <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" strokeWidth={1.6} />
                    </button>
                </div>

                {/* Mobile Drawer */}
                {mobileOpen && (
                    <div className="md:hidden fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                        <aside className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r border-border/40 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
                            <div className="absolute right-3 top-3">
                                <button
                                    onClick={() => setMobileOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" strokeWidth={1.6} />
                                </button>
                            </div>
                            <NavContent pathname={pathname} account={account} onNavigate={() => setMobileOpen(false)} />
                        </aside>
                    </div>
                )}

                {/* Main content */}
                <main className="flex-1 min-h-screen overflow-y-auto pt-12 md:pt-0">
                    {children}
                </main>
            </div>
        </ReactQueryProvider>
    );
}
