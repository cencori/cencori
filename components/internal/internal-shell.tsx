'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';
import {
    BarChart3,
    Mail,
    Settings,
    TrendingUp,
    LayoutDashboard,
    LogOut,
    Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
    { href: '/internal', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/internal/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/internal/events', label: 'Events', icon: Activity },
    { href: '/internal/kpi', label: 'KPIs', icon: TrendingUp },
    { href: '/internal/emails', label: 'Emails', icon: Mail },
    { href: '/internal/settings', label: 'Settings', icon: Settings },
];

export function InternalShell({
    children,
    userEmail,
}: {
    children: React.ReactNode;
    userEmail: string;
}) {
    const pathname = usePathname();

    return (
        <ReactQueryProvider>
            <div className="min-h-screen bg-background flex">
                {/* Sidebar */}
                <aside className="w-56 shrink-0 border-r border-border/40 bg-card/30 flex flex-col sticky top-0 h-screen">
                    {/* Logo / Title */}
                    <div className="px-4 py-4 border-b border-border/30">
                        <Link href="/internal" className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-emerald-500/20 flex items-center justify-center">
                                <span className="text-emerald-400 text-xs font-bold">C</span>
                            </div>
                            <span className="text-sm font-semibold">Internal</span>
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
                                    className={cn(
                                        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                                        isActive
                                            ? "bg-secondary text-foreground font-medium"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="px-3 py-3 border-t border-border/30 space-y-2">
                        <p className="text-[10px] text-muted-foreground truncate px-1">
                            {userEmail}
                        </p>
                        <form action="/api/auth/signout" method="POST">
                            <button
                                type="submit"
                                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Sign out
                            </button>
                        </form>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 min-h-screen overflow-y-auto">
                    {children}
                </main>
            </div>
        </ReactQueryProvider>
    );
}
