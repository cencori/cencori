"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";

interface DocsTOCProps {
    className?: string;
}

interface Heading {
    id: string;
    text: string;
    level: number;
}

export function DocsTOC({ className }: DocsTOCProps) {
    const [headings, setHeadings] = React.useState<Heading[]>([]);
    const [activeId, setActiveId] = React.useState<string>("");
    const pathname = usePathname();

    React.useEffect(() => {
        const elements = Array.from(document.querySelectorAll("h2, h3"))
            .filter((element) => element.id)
            .map((element) => ({
                id: element.id,
                text: element.textContent || "",
                level: Number(element.tagName.substring(1)),
            }));
        setHeadings(elements);

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            { rootMargin: "0px 0px -80% 0px" }
        );

        elements.forEach((heading) => {
            const element = document.getElementById(heading.id);
            if (element) observer.observe(element);
        });

        return () => observer.disconnect();
    }, [pathname]);

    if (headings.length === 0) return null;

    return (
        <aside className={cn("w-48 shrink-0 hidden xl:block h-[calc(100vh-4rem)] px-4 py-12 lg:py-20 sticky top-16 overflow-y-auto py-6 pl-6", className)}>
            <h4 className="font-medium text-sm mb-4 text-foreground/90">On this page</h4>
            <ul className="space-y-2 text-sm">
                {headings.map((heading) => (
                    <li key={heading.id} style={{ paddingLeft: (heading.level - 2) * 16 }}>
                        <a
                            href={`#${heading.id}`}
                            className={cn(
                                "block transition-colors hover:text-foreground/80",
                                activeId === heading.id
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground"
                            )}
                            onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(heading.id)?.scrollIntoView({
                                    behavior: "smooth",
                                });
                                setActiveId(heading.id);
                            }}
                        >
                            {activeId === heading.id ? (
                                <div className="relative inline-block">
                                    <span className="relative z-10">{heading.text}</span>
                                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-1 bg-primary rounded-full" />
                                </div>
                            ) : (
                                heading.text
                            )}
                        </a>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
