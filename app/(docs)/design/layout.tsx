"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
    { name: "Introduction", href: "/design" },
    { name: "Principles", href: "/design/principles" },
    { name: "Typography", href: "/design/typography" },
    { name: "Colors", href: "/design/colors" },
    { name: "Spacing", href: "/design/spacing" },
    { name: "Components", href: "/design/components" },
    { name: "Layouts", href: "/design/layouts" },
    { name: "Icons", href: "/design/icons" },
    { name: "Animation", href: "/design/animation" },
    { name: "Accessibility", href: "/design/accessibility" },
    { name: "Checklist", href: "/design/checklist" },
];

function NavLink({ item, isActive, onClick }: {
    item: typeof navigation[0];
    isActive: boolean;
    onClick?: () => void;
}) {
    return (
        <Link
            href={item.href}
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

    const isActive = (href: string) => {
        if (href === "/design") {
            return pathname === "/design";
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-4 border-b border-border/40">
                <Link href="/design" className="flex items-center gap-2">
                    <Logo variant="mark" className="h-5" />
                    <span className="text-sm font-semibold">Cenpact</span>
                </Link>
                <p className="text-[10px] text-muted-foreground mt-1">Design System</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navigation.map((item) => (
                    <NavLink
                        key={item.href}
                        item={item}
                        isActive={isActive(item.href)}
                        onClick={onLinkClick}
                    />
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground">Version 1.2</p>
                <Link
                    href="/"
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

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-12 px-4 border-b border-border/40 bg-background/95 backdrop-blur">
                <Link href="/design" className="flex items-center gap-2">
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
                <main className="flex-1 min-h-screen">
                    <div className="max-w-4xl mx-auto px-6 py-12">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
