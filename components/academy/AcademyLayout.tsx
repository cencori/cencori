"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AcademyLayoutProps {
    children: ReactNode;
}

export function AcademyLayout({ children }: AcademyLayoutProps) {
    const pathname = usePathname();
    const isHome = pathname === "/academy";

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex h-14 items-center justify-between">
                        <div className="flex items-center gap-4">
                            {!isHome && (
                                <Link href="/academy">
                                    <Button variant="ghost" size="sm" className="gap-2">
                                        <ChevronLeft className="h-4 w-4" />
                                        <span className="hidden sm:inline">Academy</span>
                                    </Button>
                                </Link>
                            )}
                            <Link href="/academy" className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                    <GraduationCap className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-semibold">Cencori Academy</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/docs">
                                <Button variant="ghost" size="sm">
                                    Docs
                                </Button>
                            </Link>
                            <Link href="/dashboard">
                                <Button variant="outline" size="sm">
                                    Dashboard
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 md:px-6 py-8 md:py-12">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-border/40 py-6">
                <div className="container mx-auto px-4 md:px-6">
                    <p className="text-sm text-muted-foreground text-center">
                        © {new Date().getFullYear()} Cencori. Learn to build with AI.
                    </p>
                </div>
            </footer>
        </div>
    );
}
