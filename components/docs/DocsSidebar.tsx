"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface DocsSidebarProps {
    className?: string;
}

interface SidebarItem {
    title: string;
    href: string;
    order: number;
}

interface SidebarSection {
    title: string;
    items: SidebarItem[];
}

function SidebarLinkItem({ item, pathname }: { item: SidebarItem; pathname: string }) {
    const isActive = pathname === item.href;
    return (
        <li className="relative">
            <Link
                href={item.href}
                className={cn(
                    "group flex items-center gap-2 py-1.5 pl-4 pr-3 text-[13px] transition-all relative",
                    isActive
                        ? "text-foreground font-medium bg-muted/50 rounded-md"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                {isActive && (
                    <div className="absolute left-[-1px] top-0 bottom-0 w-[2px] bg-foreground rounded-full z-10" />
                )}
                {item.title}
            </Link>
        </li>
    );
}

export function DocsSidebar({ className }: DocsSidebarProps) {
    const pathname = usePathname();
    const [sections, setSections] = useState<SidebarSection[]>([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/docs/navigation", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json() as { sections?: SidebarSection[] };
                if (!cancelled) setSections(data.sections || []);
            } catch {
                // If fetch fails we keep an empty sidebar state.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const activeSection = useMemo(() => {
        const current = sections.find((group) => group.items.some((item) => item.href === pathname));
        return current?.title;
    }, [sections, pathname]);

    const defaultOpenSections = useMemo(() => {
        if (activeSection) return [activeSection];
        return sections.length > 0 ? [sections[0].title] : [];
    }, [activeSection, sections]);

    return (
        <aside className={cn("w-64 shrink-0 hidden md:block border-r border-border/40 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto bg-background/50 backdrop-blur-sm", className)}>
            <div className="px-3 py-6 lg:py-8">
                <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full space-y-2">
                    {sections.map((group) => (
                        <AccordionItem key={group.title} value={group.title} className="border-none">
                            <AccordionTrigger className="py-1.5 px-3 text-xs font-medium hover:no-underline hover:text-foreground transition-all text-muted-foreground data-[state=open]:text-foreground decoration-none">
                                {group.title}
                            </AccordionTrigger>
                            <AccordionContent className="pb-1 mt-1">
                                <ul className="relative ml-3.5 border-l border-border/60">
                                    {group.items.map((item) => (
                                        <SidebarLinkItem key={item.href} item={item} pathname={pathname} />
                                    ))}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </aside>
    );
}

