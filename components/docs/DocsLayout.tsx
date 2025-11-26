import { ReactNode } from "react";
import { DocsSidebar } from "./DocsSidebar";
import { DocsTOC } from "./DocsTOC";
import { cn } from "@/lib/utils";

interface DocsLayoutProps {
    children: ReactNode;
    className?: string;
}

export function DocsLayout({ children, className }: DocsLayoutProps) {
    return (
        <div className="container mx-auto px-4 md:px-6 flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_240px] xl:grid-cols-[260px_minmax(0,1fr)_260px] gap-6 lg:gap-10">
            <DocsSidebar />
            <main className={cn("relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_260px]", className)}>
                <div className="mx-auto w-full min-w-0">
                    {children}
                </div>
            </main>
            <DocsTOC />
        </div>
    );
}
