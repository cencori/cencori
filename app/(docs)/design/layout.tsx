"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Base navigation paths (relative to /design)
const navigationItems = [
    { name: "Introduction", path: "" },
    { name: "Principles", path: "/principles" },
    { name: "Typography", path: "/typography" },
    { name: "Colors", path: "/colors" },
    { name: "Spacing", path: "/spacing" },
    { name: "Components", path: "/components" },
    { name: "Layouts", path: "/layouts" },
    { name: "Icons", path: "/icons" },
    { name: "Animation", path: "/animation" },
    { name: "Accessibility", path: "/accessibility" },
    { name: "Checklist", path: "/checklist" },
];

// Hook to detect if we're on the design subdomain
function useIsDesignSubdomain() {
    const [isSubdomain, setIsSubdomain] = React.useState(false);

    React.useEffect(() => {
        const hostname = window.location.hostname;
        setIsSubdomain(hostname.startsWith('design.'));
    }, []);

    return isSubdomain;
}

function NavLink({ item, isActive, onClick, isSubdomain }: {
    item: typeof navigationItems[0];
    isActive: boolean;
    onClick?: () => void;
    isSubdomain: boolean;
}) {
    // On subdomain: use /path, on main domain: use /design/path
    const href = isSubdomain
        ? (item.path === "" ? "/" : item.path)
        : `/design${item.path}`;

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "block px-3 py-2 text-xs rounded-lg transition-colors",
                isActive
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
        >
            {item.name}
        </Link>
    );
}

function Sidebar({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname();
    const isSubdomain = useIsDesignSubdomain();

    const isActive = (path: string) => {
        // Normalize paths for comparison
        const normalizedPath = path === "" ? "/design" : `/design${path}`;
        if (path === "") {
            return pathname === "/design" || pathname === "/";
        }
        return pathname.includes(path);
    };

    const logoHref = isSubdomain ? "/" : "/design";

    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-4 border-b border-border/40">
                <Link href={logoHref} className="flex items-center gap-2">
                    <Logo variant="mark" className="h-5" />
                    <span className="text-sm font-semibold">Cenpact</span>
                </Link>
                <p className="text-[10px] text-muted-foreground mt-1">Design System</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navigationItems.map((item) => (
                    <NavLink
                        key={item.path}
                        item={item}
                        isActive={isActive(item.path)}
                        onClick={onLinkClick}
                        isSubdomain={isSubdomain}
                    />
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground">Version 1.2</p>
                <Link
                    href={isSubdomain ? "https://cencori.com" : "/"}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                >
                    Back to Cencori <ChevronRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}

export default function DesignDocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [open, setOpen] = React.useState(false);
    const isSubdomain = useIsDesignSubdomain();
    const logoHref = isSubdomain ? "/" : "/design";

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-12 px-4 border-b border-border/40 bg-background/95 backdrop-blur">
                <Link href={logoHref} className="flex items-center gap-2">
                    <Logo variant="mark" className="h-4" />
                    <span className="text-sm font-semibold">Cenpact</span>
                </Link>
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Menu className="h-4 w-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-0">
                        <Sidebar onLinkClick={() => setOpen(false)} />
                    </SheetContent>
                </Sheet>
            </header>

            <div className="flex">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:block w-64 h-[calc(100vh)] sticky top-0 border-r border-border/40">
                    <Sidebar />
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-h-screen overflow-x-hidden">
                    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
