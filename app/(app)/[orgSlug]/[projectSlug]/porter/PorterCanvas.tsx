"use client";

import type { Porter } from "./shared";
import { PorterPreview } from "./PorterPreview";

/**
 * The surface a Porter is dressed on.
 *
 * Not a page preview -- that lives at /porter-preview and runs the real porter.js on a real page.
 * This is the workbench: a canvas with the widget floating on it, so changing how it looks shows
 * the result immediately rather than after a save and a reload. The grid is there to say "this is a
 * working surface, not a website", which is the distinction between the two.
 *
 * The conversation inside is live, so the thing being dressed is also the thing that answers.
 */
export function PorterCanvas({ porter }: { porter: Porter }) {
    const brand = { ...(porter.brand ?? {}), ...(porter.brand_overrides ?? {}) } as {
        color?: string;
        logo?: string;
    };
    const accent = brand.color || "#111111";

    return (
        <div
            className="relative h-full w-full overflow-hidden bg-muted/20"
            style={{
                backgroundImage:
                    "radial-gradient(circle, color-mix(in srgb, currentColor 14%, transparent) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
            }}
        >
            <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="flex h-full max-h-[620px] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                    <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
                        {brand.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={brand.logo} alt="" className="size-6 rounded-md object-cover" />
                        ) : (
                            <span
                                aria-hidden
                                className="flex size-6 items-center justify-center rounded-md text-[11px] font-semibold text-white"
                                style={{ background: accent }}
                            >
                                {porter.name.charAt(0)}
                            </span>
                        )}
                        <span className="flex-1 truncate text-sm font-semibold">{porter.name}</span>
                        {/* The widget has a close; a canvas has nowhere to close to, so it is shown
                            and inert rather than absent -- the point is what the visitor sees. */}
                        <span
                            aria-hidden
                            className="cursor-default rounded p-1 text-xl leading-none text-muted-foreground"
                        >
                            ×
                        </span>
                    </header>

                    <PorterPreview
                        porter={porter}
                        greeting={porter.greeting || `Hi — ask me anything about ${porter.name}.`}
                        className="min-h-0 flex-1 rounded-none border-0"
                    />

                    <p className="shrink-0 pb-3 pt-2.5 text-center text-[.7rem] text-muted-foreground">
                        <a
                            href="https://cencori.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground no-underline hover:underline"
                        >
                            Powered by Cencori
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
