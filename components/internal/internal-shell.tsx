'use client';

import React, { useState } from 'react';
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
    ArrowRightLeft,
    CheckSquare,
    Menu,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

const NAV_ITEMS = [
    { href: '/internal', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/internal/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/internal/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/internal/events', label: 'Events', icon: Activity },
    { href: '/internal/kpi', label: 'KPIs', icon: TrendingUp },
    { href: '/internal/emails', label: 'Emails', icon: Mail },
    { href: '/internal/model-mappings', label: 'Mappings', icon: ArrowRightLeft },
    { href: '/internal/settings', label: 'Settings', icon: Settings },
];

function NavContent({ pathname, userEmail, onNavigate }: { pathname: string; userEmail: string; onNavigate?: () => void }) {
    return (
        <>
            {/* Logo / Title */}
            <div className="px-4 py-4 border-b border-border/30">
                <Link href="/internal" className="flex items-center gap-2" onClick={onNavigate}>
                    <Logo variant="wordmark" className="h-4" />
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
                            onClick={onNavigate}
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
        </>
    );
}

export function InternalShell({
    children,
    userEmail,
}: {
    children: React.ReactNode;
    userEmail: string;
}) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <ReactQueryProvider>
            <div className="min-h-screen bg-background flex">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex w-56 shrink-0 border-r border-border/40 bg-card/30 flex-col sticky top-0 h-screen">
                    <NavContent pathname={pathname} userEmail={userEmail} />
                </aside>

                {/* Mobile Top Bar */}
                <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-background/95 backdrop-blur-sm border-b border-border/30 flex items-center justify-between px-4">
                    <Link href="/internal" className="flex items-center gap-2">
                        <Logo variant="wordmark" className="h-4" />
                        <span className="text-sm font-semibold">Internal</span>
                    </Link>
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
                    >
                        <Menu className="h-5 w-5" />
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
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <NavContent pathname={pathname} userEmail={userEmail} onNavigate={() => setMobileOpen(false)} />
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
