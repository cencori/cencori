"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useDocsContext } from "./DocsContext";
import { motion, AnimatePresence } from "framer-motion";

interface Heading {
    id: string;
    title: string;
    level: number;
}

export function DocsTOC({ className }: { className?: string }) {
    const pathname = usePathname();
    const { setAskAIOpen, setAttachedPage } = useDocsContext();
    const [headings, setHeadings] = React.useState<Heading[]>([]);
    const [activeId, setActiveId] = React.useState<string>("");
    const itemRefs = React.useRef<Map<string, HTMLLIElement>>(new Map());

    React.useEffect(() => {
        const elements = Array.from(document.querySelectorAll("h2, h3"))
            .filter((element) => element.id)
            .map((element) => ({
                id: element.id,
                title: element.textContent || "",
                level: Number(element.tagName.substring(1)) - 1,
            }));
        setHeadings(elements);

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntries = entries.filter((entry) => entry.isIntersecting);
                if (visibleEntries.length > 0) {
                    const nearest = visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                    setActiveId(nearest.target.id);
                }
            },
            { rootMargin: "-80px 0% -80% 0%" }
        );

        elements.forEach((heading) => {
            const el = document.getElementById(heading.id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [pathname]);

    const activeItem = itemRefs.current.get(activeId);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => setCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [copied]);

    if (headings.length === 0) return null;

    return (
        <aside className={cn("w-52 shrink-0 hidden xl:block h-[calc(100vh-4rem)] px-4 py-8 sticky top-16 overflow-y-auto", className)}>
            <div className="relative">
                <h4 className="font-medium text-sm mb-4 text-foreground/90 px-4">On this page</h4>

                <ul className="relative space-y-1 text-[13px]">
                    {headings.map((heading) => (
                        <li
                            key={heading.id}
                            ref={(el) => {
                                if (el) itemRefs.current.set(heading.id, el);
                                else itemRefs.current.delete(heading.id);
                            }}
                            className={cn(
                                "relative pl-4 py-1 transition-colors duration-200",
                                heading.level === 2 ? "ml-2" : "",
                                activeId === heading.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <a href={`#${heading.id}`} className="block">
                                {heading.title}
                            </a>
                        </li>
                    ))}
                </ul>

                {/* Secondary Actions */}
                <div className="mt-8 px-4 space-y-4">
                    <button
                        onClick={async () => {
                            const path = pathname.replace('/docs/', '');
                            try {
                                const res = await fetch(`/api/docs/raw?slug=${path}`);
                                const data = await res.json();
                                if (data.content) {
                                    await navigator.clipboard.writeText(data.content);
                                    setCopied(true);
                                }
                            } catch (e) {
                                console.error("Failed to copy markdown", e);
                            }
                        }}
                        className="flex items-center gap-3 text-[13px] text-muted-foreground hover:text-foreground transition-colors group w-full text-left"
                    >
                        <div className="h-4 w-4 flex items-center justify-center">
                            {copied ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5 text-green-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5 0M18 3.375c0-.621-.504-1.125-1.125-1.125H9.75a1.125 1.125 0 0 0-1.125 1.125V15c0 .621.504 1.125 1.125 1.125h6.75A1.125 1.125 0 0 0 18 15V3.375z" />
                                </svg>
                            )}
                        </div>
                        <span>{copied ? 'Copied!' : 'Copy as Markdown'}</span>
                    </button>

                    <button
                        onClick={() => {
                            const title = document.querySelector('h1')?.textContent || 'This page';
                            const slug = pathname.replace('/docs/', '');
                            setAttachedPage({ title, slug });
                            setAskAIOpen(true);
                        }}
                        className="flex items-center gap-3 text-[13px] text-muted-foreground hover:text-foreground transition-colors group w-full text-left whitespace-nowrap"
                    >
                        <div className="h-4 w-4 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-1.154-.63 4.84 4.84 0 0 0 1.57-3.651c-2.215-1.74-3.576-4.316-3.576-7.19 0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                            </svg>
                        </div>
                        <span className="font-medium">Ask about this page</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
