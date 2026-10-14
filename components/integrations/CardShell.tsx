"use client";

/**
 * The card used for settings sections and integration tiles: an icon or partner logo, a title and
 * a one-line description, optional detail rows, and actions.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function CardShell({
    icon: Icon,
    logo,
    title,
    description,
    action,
    bottomAction,
    bottomActionDivided = false,
    layout = "row",
    className = "",
    children,
    footer,
}: {
    icon?: LucideIcon;
    /** An image (e.g. a partner's mark) shown in place of the icon. */
    logo?: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
    /** Buttons along the bottom-left of the card. */
    bottomAction?: ReactNode;
    /** Rule above the bottom actions, for when rows sit between them and the header. */
    bottomActionDivided?: boolean;
    /**
     * "row": icon beside the title, actions in the header (settings sections).
     * "tile": logo on top, title and one-liner under it, actions pinned to the bottom — an
     * integration tile that fills its grid cell.
     * "compact": icon beside the title, actions under it, and only as tall as its content — it
     * does not stretch to the height of its neighbours in a grid row.
     */
    layout?: "row" | "tile" | "compact";
    /** Extra classes on the card itself, e.g. h-full to match a neighbour's height. */
    className?: string;
    children?: ReactNode;
    footer?: ReactNode;
}) {
    const mark = (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border/35 bg-background/30">
            {logo ?? (Icon ? <Icon className="size-4 text-foreground" /> : null)}
        </div>
    );

    if (layout === "tile") {
        return (
            <div className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-lg border border-border/35 bg-muted/30">
                <div className="px-5 pt-5">
                    {mark}
                    <h2 className="mt-5 text-sm font-medium">{title}</h2>
                    <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
                <div className={children ? "mt-5" : undefined}>{children}</div>
                {bottomAction && (
                    <div className={`mt-auto flex flex-wrap items-center gap-2 px-5 ${bottomActionDivided ? "border-t border-border/30 py-4" : "pb-5 pt-5"}`}>
                        {bottomAction}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`overflow-hidden rounded-lg border border-border/35 bg-muted/30 ${layout === "compact" ? "self-start" : ""} ${className}`}>
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    {mark}
                    <div>
                        <h2 className="text-sm font-medium">{title}</h2>
                        <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                </div>
                {action}
            </div>
            {children}
            {bottomAction && (
                <div className={`flex flex-wrap items-center gap-2 px-5 ${bottomActionDivided ? "border-t border-border/30 py-4" : "pb-5"}`}>
                    {bottomAction}
                </div>
            )}
            {footer && (
                <div className="border-t border-border/30 bg-background/20 px-5 py-3">
                    <p className="max-w-2xl text-[11px] leading-5 text-muted-foreground">{footer}</p>
                </div>
            )}
        </div>
    );
}
