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
                "relative flex h-full w-full flex-col overflow-hidden bg-[#050505] p-16 md:p-24 text-foreground",
                className
            )}
        >
            {/* Subtle Texture Overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03] grayscale" 
                 style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
            
            <div className="relative z-10 flex h-full flex-col">
                {children}
            </div>
        </section>
    );
}

export function PitchHeader({
    eyebrow,
    title,
    subtitle,
    className,
}: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    className?: string;
}) {
    return (
        <header className={cn("mb-16 max-w-[80%]", className)}>
            <div className="flex items-center gap-4 mb-8">
                <p className="text-sm font-bold uppercase tracking-[0.5em] text-white/40">
                    {eyebrow}
                </p>
                <div className="h-px w-20 bg-white/10" />
            </div>
            <h2 className="text-6xl font-medium tracking-tight text-white md:text-[5.5rem] lg:text-[7.5rem] leading-[0.9] first-letter:capitalize">
                {title}
            </h2>
            {subtitle && (
                <p className="mt-12 max-w-4xl text-2xl leading-relaxed text-zinc-400 md:text-3xl font-light">
                    {subtitle}
                </p>
            )}
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
        <div className={cn("flex flex-col gap-4 py-8 border-t border-white/5", className)}>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                {label}
            </p>
            <div className="text-xl font-medium text-white md:text-3xl tracking-tight">
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
        <div className={cn("flex flex-col gap-6 py-12 border-t border-white/5", className)}>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/30">
                {label}
            </p>
            <div className="text-7xl font-medium tracking-tighter text-white md:text-[7rem] leading-none">
                {value}
            </div>
            {note && (
                <p className="text-lg text-zinc-500 font-medium tracking-tight mt-4 max-w-xs">
                    {note}
                </p>
            )}
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
                "mt-auto border-t border-white/10 pt-20",
                className
            )}
        >
            <p className="text-4xl md:text-6xl font-medium tracking-tight text-white/90 leading-[0.95] italic">
                {children}
            </p>
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
        <div className={cn("w-full overflow-hidden my-16", className)}>
            <table className="w-full border-collapse text-left">
                <thead>
                    <tr className="border-b border-white/10">
                        {headers.map((header, i) => (
                            <th
                                key={i}
                                className="pb-8 text-xs font-bold uppercase tracking-[0.4em] text-white/20"
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {rows.map((row, i) => (
                        <tr key={i} className="group transition-colors hover:bg-white/[0.02]">
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    className="py-10 text-xl md:text-2xl font-medium text-white/70 group-hover:text-white transition-colors tracking-tight"
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

export function PitchGrid({
    children,
    cols = 2,
    className,
}: {
    children: React.ReactNode;
    cols?: number;
    className?: string;
}) {
    return (
        <div className={cn(
            "grid gap-x-24 gap-y-16",
            cols === 2 ? "md:grid-cols-2" : 
            cols === 3 ? "md:grid-cols-3" : 
            "md:grid-cols-4",
            className
        )}>
            {children}
        </div>
    );
}
