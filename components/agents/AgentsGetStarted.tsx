"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STARTING_POINTS } from "@/components/agents/starting-points";
import { useAgentsBasePath } from "@/components/agents/studio";
import { AgentOrb } from "@/components/agents/AgentOrb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [...new Set(STARTING_POINTS.map((point) => point.category))];

/** The agents page for a project with no agents yet; laid out like the console home and Memory. */
export function AgentsGetStarted({ canManage, studioReady }: { canManage: boolean; studioReady: boolean }) {
    const basePath = useAgentsBasePath();
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<string | null>(null);
    const templates = useMemo(() => {
        const term = query.trim().toLowerCase();
        return STARTING_POINTS.filter((point) => (!category || point.category === category)
            && (!term || `${point.title} ${point.detail} ${point.category}`.toLowerCase().includes(term)));
    }, [query, category]);

    return (
        <div>
            <h2 className="mb-3 text-sm font-medium tracking-[-0.02em]">Setup</h2>
            <article className="relative flex min-h-44 flex-col overflow-hidden rounded-md bg-muted/60 p-5">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(circle 340px at 88% 50%, rgba(239, 68, 68, 0.45) 0%, rgba(239, 68, 68, 0.14) 38%, transparent 68%), radial-gradient(circle 220px at 95% 28%, rgba(244, 63, 94, 0.45) 0%, transparent 70%), radial-gradient(circle 220px at 96% 74%, rgba(249, 115, 22, 0.35) 0%, transparent 70%), radial-gradient(circle 170px at 101% 52%, rgba(168, 85, 247, 0.25) 0%, transparent 70%)",
                    }}
                />
                <div className="relative z-10 mt-auto flex flex-wrap items-end justify-between gap-4 pt-3">
                    <div className="min-w-0">
                        <p className="text-2xl font-medium tracking-tight">Build your first agent</p>
                        <p className="mt-1 max-w-[60ch] text-xs text-muted-foreground">
                            {canManage
                                ? "Give it instructions, try it here, then publish it for your customers."
                                : studioReady ? "Ask a project admin to create the first agent." : "Agent creation is available once the database is updated."}
                        </p>
                    </div>
                    {canManage && (
                        <div className="flex shrink-0 items-center gap-2">
                            <Button asChild size="sm" className="h-7 text-xs"><Link href={`${basePath}/new`}>Create agent</Link></Button>
                            <Button asChild size="sm" className="h-7 text-xs"><a href="#templates">Browse templates</a></Button>
                        </div>
                    )}
                </div>
            </article>

            {canManage && (
                <section id="templates" className="mt-8 scroll-mt-16">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <h2 className="text-sm font-medium tracking-[-0.02em]">Templates</h2>
                        <div className="flex w-full max-w-[400px] items-center justify-end gap-2">
                            <label className="flex h-7 w-full max-w-[240px] items-center gap-2 rounded-md bg-[#f3f3f1] px-2 text-muted-foreground dark:bg-[#181818]">
                                <Search className="h-4 w-4 shrink-0" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search templates"
                                    aria-label="Search templates"
                                    className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                                />
                            </label>
                            <Select value={category ?? "all"} onValueChange={(value) => setCategory(value === "all" ? null : value)}>
                                <SelectTrigger aria-label="Use case" className="!h-7 w-[140px] shrink-0 gap-2 rounded-md border-0 bg-[#f3f3f1] px-2 text-sm text-muted-foreground shadow-none dark:bg-[#181818] dark:hover:bg-[#181818]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <SelectItem value="all" className="text-sm">All use cases</SelectItem>
                                    {CATEGORIES.map((item) => <SelectItem key={item} value={item} className="text-sm">{item}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {templates.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">No templates match{query.trim() ? <> &ldquo;{query.trim()}&rdquo;</> : " this filter"}.</p>}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {templates.map((point) => (
                            <Link key={point.id} href={`${basePath}/new?start=${point.id}`} className="group flex flex-col rounded-md bg-muted/60 p-5 transition-colors hover:bg-muted">
                                <span className="flex items-center gap-2.5 text-sm font-medium">
                                    <AgentOrb seed={point.id} />
                                    <span className="min-w-0 flex-1 truncate">{point.title}</span>
                                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                                </span>
                                <span className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{point.detail}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

        </div>
    );
}
