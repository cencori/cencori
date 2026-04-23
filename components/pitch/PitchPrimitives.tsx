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
                "flex h-full flex-col overflow-hidden bg-[#050505] px-7 py-6 text-zinc-50 md:px-8 md:py-7",
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
                "mb-5 border-b border-white/10 pb-4",
                aside ? "grid gap-4 md:grid-cols-[1fr_auto] md:items-end" : "",
                className
            )}
        >
            <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-500">
                    {eyebrow}
                </p>
                <h2 className="mt-2 max-w-5xl text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-[2.45rem]">
                    {title}
                </h2>
                {subtitle ? (
                    <p className="mt-2 max-w-4xl text-[13px] leading-5 text-zinc-500 md:text-sm md:leading-6">
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
        <div className={cn("min-w-0", className)}>
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                {label}
            </p>
            <div className="mt-1.5 text-sm font-medium text-zinc-100 md:text-base">
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
        <div className={cn("min-w-0", className)}>
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                {label}
            </p>
            <div className="mt-1.5 text-3xl font-semibold tracking-[-0.05em] text-white md:text-4xl">
                {value}
            </div>
            {note ? (
                <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 md:text-xs">
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
        <div className={cn("border-t border-white/10", className)}>
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
                            "border-b border-white/10 py-3",
                            numbered ? "grid gap-2 md:grid-cols-[auto_1fr]" : ""
                        )}
                    >
                        {numbered ? (
                            <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">
                                {String(index + 1).padStart(2, "0")}
                            </div>
                        ) : null}
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-100">
                                {normalized.title}
                            </div>
                            {normalized.description ? (
                                <div className="mt-1 text-[12px] leading-5 text-zinc-500 md:text-[13px]">
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
                "border-t border-white/10 pt-4 text-lg font-medium leading-8 tracking-[-0.03em] text-white md:text-xl",
                className
            )}
        >
            {children}
        </div>
    );
}
