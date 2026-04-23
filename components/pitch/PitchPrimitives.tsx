import React from "react";
import { cn } from "@/lib/utils";

export function PitchSlide({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                "flex h-full flex-col overflow-hidden bg-background px-4 py-1 text-foreground md:px-4 md:py-2",
                className
            )}
        >
            {children}
        </section>
    );
}

export function PitchHeader({
    eyebrow,
    title,
    subtitle,
    aside,
    className,
}: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    aside?: React.ReactNode;
    className?: string;
}) {
    return (
        <header
            className={cn(
                "mb-2   pb-2",
                aside ? "grid gap-2 md:grid-cols-[1fr_auto] md:items-end" : "",
                className
            )}
        >
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                    {eyebrow}
                </p>
                <h2 className="mt-4 max-w-5xl text-3xl font-medium tracking-tight text-foreground md:text-5xl">
                    {title}
                </h2>
                {subtitle ? (
                    <p className="mt-4 max-w-4xl text-base leading-relaxed text-muted-foreground md:text-lg">
                        {subtitle}
                    </p>
                ) : null}
            </div>
            {aside ? <div className="text-right">{aside}</div> : null}
        </header>
    );
}

export function PitchMeta({
    label,
    value,
    className,
}: {
    label: string;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("min-w-0 flex flex-col gap-1.5", className)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/80">
                {label}
            </p>
            <div className="text-sm font-medium text-foreground md:text-base">
                {value}
            </div>
        </div>
    );
}

export function PitchNumber({
    label,
    value,
    note,
    className,
}: {
    label: string;
    value: React.ReactNode;
    note?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("min-w-0 flex flex-col gap-1.5", className)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/80">
                {label}
            </p>
            <div className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
                {value}
            </div>
            {note ? (
                <p className="text-xs text-muted-foreground">
                    {note}
                </p>
            ) : null}
        </div>
    );
}

export function PitchRuleList({
    items,
    numbered = false,
    className,
}: {
    items: Array<React.ReactNode | { title: React.ReactNode; description?: React.ReactNode }>;
    numbered?: boolean;
    className?: string;
}) {
    return (
        <div className={cn(" ", className)}>
            {items.map((item, index) => {
                const normalized =
                    typeof item === "object" &&
                    item !== null &&
                    "title" in item &&
                    !React.isValidElement(item)
                        ? item
                        : { title: item, description: undefined };

                return (
                    <div
                        key={index}
                        className={cn(
                            "  py-1",
                            numbered ? "grid gap-2 md:grid-cols-[auto_1fr]" : ""
                        )}
                    >
                        {numbered ? (
                            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                                {String(index + 1).padStart(2, "0")}
                            </div>
                        ) : null}
                        <div className="min-w-0">
                            <div className="text-base font-medium text-foreground">
                                {normalized.title}
                            </div>
                            {normalized.description ? (
                                <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                    {normalized.description}
                                </div>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function PitchQuote({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "pt-4 text-xl font-medium tracking-tight text-foreground md:text-2xl border-t border-white/10 italic",
                className
            )}
        >
            {children}
        </div>
    );
}

export function PitchTable({
    headers,
    rows,
    className,
}: {
    headers: string[];
    rows: React.ReactNode[][];
    className?: string;
}) {
    return (
        <div className={cn("w-full overflow-hidden", className)}>
            <table className="w-full border-collapse text-left">
                <thead>
                    <tr className="border-b border-white/10">
                        {headers.map((header, i) => (
                            <th
                                key={i}
                                className="pb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/80"
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {rows.map((row, i) => (
                        <tr key={i} className="group">
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    className="py-4 text-sm font-medium text-foreground/90 transition-colors group-hover:text-foreground md:text-base"
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
