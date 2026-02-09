"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface DocsTOCProps {
    className?: string;
}

interface Heading {
    id: string;
    text: string;
    level: number;
}

export function DocsTOC({ className }: DocsTOCProps) {
    const [points, setPoints] = React.useState<{ id: string; title: string; level: number }[]>([]);

    React.useEffect(() => {
        // Collect headings
        const elements = Array.from(document.querySelectorAll("h2, h3"))
            .filter((element) => element.id)
            .map((element) => ({
                id: element.id,
                title: element.textContent || "",
                level: Number(element.tagName.substring(1)) - 1, // normalize h2->1, h3->2
            }));
        setPoints(elements);
    }, []);

    if (points.length === 0) return null;

    return (
        <aside className={cn("w-52 shrink-0 hidden xl:block h-[calc(100vh-4rem)] px-4 py-8 sticky top-16 overflow-y-auto", className)}>
            <h4 className="font-medium text-sm mb-4 text-foreground/90">On this page</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
                {points.map((p) => (
                    <li key={p.id} className={cn(p.level === 2 && "ml-3")}>
                        <a
                            href={`#${p.id}`}
                            className="hover:text-foreground transition-colors"
                        >
                            {p.title}
                        </a>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
