"use client";

import { useEffect, useState } from "react";
import { COPILOT_HIGHLIGHT_EVENT } from "@/lib/console/copilot";

// How long to wait for the spot to render (the page may still be loading),
// and how long the outline stays.
const FIND_FOR_MS = 10_000;
const SHOW_FOR_MS = 7_000;
const PAD = 6;

type Box = { top: number; left: number; width: number; height: number };

const CONTROL = "button, a, [role=tab], [role=button], [role=menuitem]";
const TEXT_CANDIDATES = `h1, h2, h3, h4, h5, label, th, dt, p, span, ${CONTROL}`;
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const visible = (node: Element) => node.getClientRects().length > 0;

/**
 * The heading, setting or button whose visible text matches, outside the
 * Copilot panel: exact before prefix before contains, controls and headings
 * before loose text, the page before the sidebar.
 */
function findByText(text: string): HTMLElement | null {
    const want = normalize(text);
    let best: HTMLElement | null = null;
    let bestRank = Infinity;
    for (const node of Array.from(document.querySelectorAll<HTMLElement>(TEXT_CANDIDATES))) {
        if (node.closest('aside[aria-label="Cencori copilot"], [data-copilot-spotlight]') || !visible(node)) continue;
        const own = normalize(node.textContent ?? "");
        if (!own || own.length > want.length + 40) continue;
        const match = own === want ? 0 : own.startsWith(want) ? 1 : own.includes(want) ? 2 : -1;
        if (match < 0) continue;
        const rank = match
            + (node.matches(CONTROL) || /^(H\d|LABEL)$/.test(node.tagName) ? 0 : 0.5)
            + (node.closest("main") ? 0 : 0.25);
        if (rank < bestRank) {
            best = node;
            bestRank = rank;
        }
    }
    return best ? frame(best) : null;
}

/**
 * What to outline around a text match: a button or tab on its own; a section
 * heading with its section; a setting's name with its row (the nearest box
 * that also holds the control).
 */
function frame(node: HTMLElement): HTMLElement {
    if (node.matches(CONTROL)) return node;
    if (/^H[1-4]$/.test(node.tagName)) {
        const section = node.closest("section");
        if (section && section.getBoundingClientRect().height < window.innerHeight * 0.9) return section;
    }
    let parent = node.parentElement;
    for (let level = 0; parent && level < 4; level++, parent = parent.parentElement) {
        if (parent.querySelector("input, button, select, textarea, [role=switch], [role=checkbox], [role=combobox]") && parent.getBoundingClientRect().height < 240) {
            return parent;
        }
    }
    return node;
}

/**
 * The outline Copilot draws around the part of the page it's pointing at.
 * Looks only: it never takes clicks, and goes away after a few seconds, on
 * any click or on Escape.
 */
export function CopilotSpotlight() {
    const [shown, setShown] = useState<{ box: Box; label: string; leaving: boolean } | null>(null);

    useEffect(() => {
        let stop: (() => void) | null = null;

        const onHighlight = (event: Event) => {
            stop?.();
            const { selector, text, label, navigating } = (event as CustomEvent<{ selector?: string; text?: string; label: string; navigating?: boolean }>).detail;
            const started = Date.now();
            // Opening another page: don't match anything on the one being left.
            const from = window.location.pathname + window.location.search;
            const arrived = () => !navigating || window.location.pathname + window.location.search !== from || Date.now() - started > 2_000;
            let element: HTMLElement | null = null;
            let shownAt = 0;
            let frame = 0;
            let leaveTimer = 0;
            let last = "";

            // The visible match: pages render some parts twice (phone and desktop).
            const find = () => selector
                ? Array.from(document.querySelectorAll<HTMLElement>(selector)).find(visible) ?? null
                : text ? findByText(text) : null;

            const tick = () => {
                // Not there yet, or the page changed under it: look again.
                if (!element?.isConnected) {
                    element = arrived() ? find() : null;
                    if (element) {
                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                        shownAt ||= Date.now();
                    } else if (Date.now() - started > FIND_FOR_MS) {
                        return stop?.();
                    }
                }
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const box = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
                    const key = `${box.top}|${box.left}|${box.width}|${box.height}`;
                    if (key !== last) {
                        last = key;
                        setShown((current) => ({ box, label, leaving: current?.leaving ?? false }));
                    }
                    if (shownAt && Date.now() - shownAt > SHOW_FOR_MS) return leave();
                }
                frame = window.requestAnimationFrame(tick);
            };

            // Fade out, then clear.
            const leave = () => {
                window.cancelAnimationFrame(frame);
                setShown((current) => (current ? { ...current, leaving: true } : null));
                leaveTimer = window.setTimeout(() => setShown(null), 300);
                cleanup();
            };
            const onKey = (keyEvent: KeyboardEvent) => { if (keyEvent.key === "Escape") leave(); };
            const cleanup = () => {
                window.removeEventListener("pointerdown", leave, true);
                window.removeEventListener("keydown", onKey);
            };
            window.addEventListener("pointerdown", leave, true);
            window.addEventListener("keydown", onKey);

            stop = () => {
                window.cancelAnimationFrame(frame);
                window.clearTimeout(leaveTimer);
                cleanup();
                setShown(null);
                stop = null;
            };
            setShown(null);
            frame = window.requestAnimationFrame(tick);
        };

        window.addEventListener(COPILOT_HIGHLIGHT_EVENT, onHighlight);
        return () => {
            window.removeEventListener(COPILOT_HIGHLIGHT_EVENT, onHighlight);
            stop?.();
        };
    }, []);

    if (!shown) return null;
    const { box, label, leaving } = shown;
    return (
        <div
            aria-hidden
            data-copilot-spotlight
            className={`pointer-events-none fixed z-[60] rounded-lg ring-2 ring-violet-500 transition-opacity duration-300 animate-in fade-in zoom-in-[0.98] ${leaving ? "opacity-0" : "opacity-100"}`}
            style={{
                top: box.top,
                left: box.left,
                width: box.width,
                height: box.height,
            }}
        >
            <span className="absolute -top-2.5 left-3 -translate-y-full rounded-md bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
                {label}
            </span>
        </div>
    );
}
