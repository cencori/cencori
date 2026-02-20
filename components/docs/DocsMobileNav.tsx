"use client";

import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlignLeft, Search, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";
import Link from "next/link";
import { useDocsContext } from "./DocsContext";

interface DocsMobileNavProps {
    onOpenSearch: () => void;
}

export function DocsMobileNav({ onOpenSearch }: DocsMobileNavProps) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const { setAskAIOpen } = useDocsContext();

    // Determine current section based on path for breadcrumb
    const getSectionTitle = () => {
        if (pathname.includes("/docs/ai")) return "AI SDK";
        if (pathname.includes("/docs/agents")) return "Agents";
        if (pathname.includes("/docs/platform")) return "Platform";
        if (pathname.includes("/docs/integrations")) return "Integrations";
        if (pathname.includes("/docs/security")) return "Security";
        if (pathname.includes("/docs/concepts")) return "Core Concepts";
        if (pathname.includes("/docs/guides")) return "Guides";
        if (pathname.includes("/docs/api")) return "API Reference";
        return "Documentation";
    };

    return (
        <div className="flex md:hidden flex-col border-b border-border/40 bg-background sticky top-12 z-30 w-full">
            <div className="container flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shrink-0">
                                <AlignLeft className="h-5 w-5" />
                                <span className="sr-only">Toggle Menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="pr-0 pt-0">
                            <SheetHeader className="px-6 py-4 border-b">
                            </SheetHeader>
                            <div className="px-2 py-4 h-full overflow-y-auto">
                                <DocsSidebar className="block border-none h-auto w-full relative top-0" />
                            </div>
                        </SheetContent>
                    </Sheet>

                    <div className="flex items-center gap-1 font-medium text-sm truncate">
                        <span className="text-muted-foreground">Docs</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-foreground">{getSectionTitle()}</span>
                    </div>
                </div>

            </div>

        </div>
    );
}
