"use client";

import { cn } from "@/lib/utils";

/**
 * The layout of the console's settings pages (project and organization
 * settings), for an agent's Settings: a page label, then sections with their
 * title on the left and a card of rows on the right.
 */

export function SettingsPageLabel({ title, description }: { title: string; description: string }) {
    return (
        <header className="border-b border-border/35 pb-5">
            <h1 className="text-xl font-medium tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
        </header>
    );
}

/** One section: its title and description in the left column, the settings on the right. */
export function SettingsSection({ id, title, description, aside, children }: { id?: string; title: string; description: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section id={id} className="grid scroll-mt-20 gap-4 border-t border-border/35 py-7 first-of-type:border-t-0 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-9">
            <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-3 lg:block">
                    <h2 className="text-sm font-medium">{title}</h2>
                    {aside && <div className="lg:mt-3">{aside}</div>}
                </div>
                <div className="text-xs leading-5 text-muted-foreground md:text-[11px]">{description}</div>
            </div>
            <div className="min-w-0 space-y-4">{children}</div>
        </section>
    );
}

export function SettingsCard({ className, danger, children }: { className?: string; danger?: boolean; children: React.ReactNode }) {
    return (
        <div className={cn("overflow-hidden rounded-lg border", danger ? "border-red-500/30 bg-red-500/5" : "border-border/35 bg-muted/30", className)}>
            {children}
        </div>
    );
}

/**
 * A setting: label and hint on the left, the control on the right. `stacked`
 * puts the control under the label, for wide controls like text areas.
 */
export function SettingsRow({ label, description, stacked, children, className }: { label: string; description?: React.ReactNode; stacked?: boolean; children?: React.ReactNode; className?: string }) {
    return (
        <div className={cn("gap-2 border-b border-border/30 px-4 py-3 last:border-b-0", stacked ? "flex flex-col" : "flex flex-col md:flex-row md:items-center md:justify-between md:gap-6", className)}>
            <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium md:text-xs">{label}</p>
                {description && <div className="text-xs text-muted-foreground md:text-[11px]">{description}</div>}
            </div>
            {children && <div className={cn("min-w-0", stacked ? "w-full" : "md:shrink-0")}>{children}</div>}
        </div>
    );
}

/** The card's last strip, for its Save button and any secondary action. */
export function SettingsFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("flex items-center justify-end gap-2 border-t border-border/30 bg-background/25 px-4 py-3", className)}>{children}</div>;
}

/** Inputs as the settings pages draw them. */
export const settingsInputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring disabled:opacity-60 md:h-8";

export function Segmented<T extends string>({ value, options, onChange, disabled, className }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; disabled?: boolean; className?: string }) {
    return (
        <div className={cn("inline-grid rounded-md border border-border/40 bg-background/60 p-0.5 text-xs", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
            {options.map((option) => (
                <button key={option.value} type="button" disabled={disabled} onClick={() => onChange(option.value)} className={cn("rounded px-3 py-1 transition-colors", value === option.value ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {option.label}
                </button>
            ))}
        </div>
    );
}
