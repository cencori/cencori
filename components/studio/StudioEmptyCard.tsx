import type { ReactNode } from "react";
import type { Icon } from "@solar-icons/react/lib/types";
import { cn } from "@/lib/utils";

/**
 * Lets a page fill the space between the top of the screen and the ask bar,
 * so a StudioEmptyCard inside it sits in the middle (matches the main
 * column's top and bottom padding in StudioShell).
 */
export const STUDIO_FILL_PAGE = "flex min-h-[calc(100svh-11.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col";

interface StudioEmptyCardProps {
    icon: Icon;
    title: string;
    description?: string;
    children?: ReactNode;
    className?: string;
}

/** A tab's empty state: a tall card in the middle of the page, icon over centred text. */
export function StudioEmptyCard({ icon: IconComponent, title, description, children, className }: StudioEmptyCardProps) {
    return (
        <div className={cn("my-auto flex min-h-[26rem] flex-col items-center justify-center rounded-3xl bg-muted/60 p-6 text-center", className)}>
            <IconComponent size={40} className="mb-3" />
            <p className="text-lg font-semibold">{title}</p>
            {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
            {children}
        </div>
    );
}
