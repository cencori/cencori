"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePorter } from "./shared";

/**
 * The bar every Porter page sits under.
 *
 * It lives in the layout rather than in each page so it cannot drift between Overview, Knowledge,
 * Conversations, Install and Settings, and so no page has to remember to draw it.
 *
 * Porter routes run in the fixed-height shell (see isFixedHeight in app/(app)/layout.tsx), the same
 * one the playground uses: <main> gives this a padding-free box already offset below the header and
 * clipped to the viewport. So the bar is an ordinary flex row that reaches both edges on its own,
 * and the page beneath it scrolls in its own panel rather than growing the window.
 */
export default function PorterLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);
    const base = `/${orgSlug}/${projectSlug}/porter`;
    const { data: porter } = usePorter(orgSlug, projectSlug);
    const porterId = porter?.id;

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/30 bg-background px-4 md:px-6">
                {/* The hero's pair, class for class: outline for the reversible action, filled for
                    the one that changes something. asChild rather than a Button inside a Link, so
                    this renders one anchor instead of a button nested in one. */}
                <div className="ml-auto flex items-center gap-3">
                    <Button
                        asChild
                        variant="outline"
                        className="h-7 rounded-md border-foreground/20 bg-transparent px-3 text-[11px] font-medium text-foreground/90 hover:border-foreground/40 hover:bg-foreground/5 hover:text-foreground"
                    >
                        {/* A new tab, because a preview inside the console is showing you the
                            console. This one has no chrome of its own. */}
                        <Link href={`/porter-preview/${porterId ?? ""}`} target="_blank" rel="noopener">
                            Preview
                        </Link>
                    </Button>
                    <Button
                        asChild
                        className="h-7 rounded-md bg-foreground px-3 text-[11px] font-medium text-background hover:bg-foreground/90"
                    >
                        <Link href={`${base}/install`}>Deploy</Link>
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}
