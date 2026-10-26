"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { AgentOrb } from "@/components/agents/AgentOrb";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { useAgentsBasePath } from "@/components/agents/studio";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { cn } from "@/lib/utils";

export type WidgetAppearance = {
    title: string;
    greeting: string;
    launcher_text: string;
    accent: string;
    theme: "light" | "dark" | "auto";
    position: "right" | "left";
    launcher_style: "card" | "pill";
};
export type Widget = { id: string; public_key: string; enabled: boolean; allowed_origins: string[]; appearance: WidgetAppearance; daily_session_cap: number; ready: boolean; updated_at: string };
export type WidgetPayload = { ready: boolean; message?: string; can_manage: boolean; published?: boolean; defaults?: WidgetAppearance; widget: Widget | null; preview_token: string | null; share_token?: string | null };
export type TestPanelMode = "draft" | "widget";

export async function readJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
    if (!response.ok) throw new Error(body?.error ?? "That didn't work. Try again.");
    return body as T;
}

export const widgetQueryKey = (projectId: string, agentId: string) => ["agent-widget", projectId, agentId];
export const widgetEndpoint = (projectId: string, agentId: string) => `/api/projects/${projectId}/embedded-agents/${agentId}/widget`;

/** The agent's widget settings, shared by the Settings page and the test panel. */
export function useAgentWidget(enabled = true) {
    const { projectId, agent } = useAgentWorkspace();
    return useQuery({
        queryKey: widgetQueryKey(projectId, agent.id),
        queryFn: async () => readJson<WidgetPayload>(await fetch(widgetEndpoint(projectId, agent.id), { cache: "no-store" })),
        enabled,
    });
}

/** The main site serves the widget, even when the console runs on its own host. */
export function widgetSiteOrigin() {
    return typeof window === "undefined" ? "https://cencori.com" : new URL(getMainSiteUrl("/")).origin;
}

export function readableOn(hex: string) {
    const n = parseInt(hex.slice(1), 16);
    if (Number.isNaN(n)) return "#ffffff";
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111111" : "#ffffff";
}

/**
 * Copies the agent's shareable link: a full-page chat with the published
 * version. The first share creates the widget record and its visitor
 * installation, the same as saving the Website settings.
 */
export function useCopyShareLink() {
    const { projectId, agent } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const [copying, setCopying] = useState(false);
    const published = !!agent.stable_version_id;

    const copy = useCallback(async () => {
        setCopying(true);
        try {
            const queryKey = widgetQueryKey(projectId, agent.id);
            const endpoint = widgetEndpoint(projectId, agent.id);
            const payload = await queryClient.fetchQuery({
                queryKey,
                queryFn: async () => readJson<WidgetPayload>(await fetch(endpoint, { cache: "no-store" })),
                staleTime: 30_000,
            });
            if (!payload.ready) throw new Error(payload.message ?? "Sharing isn't available yet.");
            let token = payload.share_token ?? null;
            if (!payload.widget?.ready) {
                const result = await readJson<{ widget: Widget; preview_token: string; share_token: string }>(await fetch(endpoint, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                }));
                queryClient.setQueryData<WidgetPayload>(queryKey, (current) => current ? { ...current, widget: result.widget, preview_token: result.preview_token, share_token: result.share_token } : current);
                if (!result.widget.ready) throw new Error("This agent can't be shared. It needs customer connections or knowledge that visitors don't have.");
                token = result.share_token;
            }
            if (!token) throw new Error("Only project admins can share this agent.");
            const url = `${widgetSiteOrigin()}/talk/${token}`;
            try {
                await navigator.clipboard.writeText(url);
                toast.success("Link copied", { description: "Anyone with the link can chat with the published version." });
            } catch {
                toast.error("Couldn't copy the link", { description: url });
            }
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Couldn't create the link. Try again.");
        } finally {
            setCopying(false);
        }
    }, [agent.id, projectId, queryClient]);

    return { copy, copying, published };
}

// ── Panel state shared across the agent pages ─────────────────────────────

interface WidgetPreviewValue {
    mode: TestPanelMode;
    setMode: (mode: TestPanelMode) => void;
    /** Unsaved look settings from the Settings page, shown live in the preview. */
    draftAppearance: WidgetAppearance | null;
    setDraftAppearance: (appearance: WidgetAppearance | null) => void;
    openPanel: () => void;
}

const WidgetPreviewContext = createContext<WidgetPreviewValue | null>(null);

export function WidgetPreviewProvider({ openPanel, children }: { openPanel: () => void; children: ReactNode }) {
    const [mode, setMode] = useState<TestPanelMode>("draft");
    const [draftAppearance, setDraftAppearance] = useState<WidgetAppearance | null>(null);
    const value = useMemo(() => ({ mode, setMode, draftAppearance, setDraftAppearance, openPanel }), [mode, draftAppearance, openPanel]);
    return <WidgetPreviewContext.Provider value={value}>{children}</WidgetPreviewContext.Provider>;
}

const noop = () => {};
/** Outside the agent shell (a lone panel), the panel stays in Draft mode. */
const STANDALONE: WidgetPreviewValue = { mode: "draft", setMode: noop, draftAppearance: null, setDraftAppearance: noop, openPanel: noop };

export function useWidgetPreview(): WidgetPreviewValue {
    return useContext(WidgetPreviewContext) ?? STANDALONE;
}

// ── Launcher, drawn the way public/widget.js draws it ─────────────────────

export function WidgetLauncher({ appearance, orbSeed, onOpen }: { appearance: WidgetAppearance; orbSeed: string; onOpen: () => void }) {
    const accentFg = readableOn(appearance.accent);
    if (appearance.launcher_style === "pill") {
        return (
            <button type="button" onClick={onOpen} className="inline-flex h-11 items-center gap-2 rounded-full pl-3.5 pr-4 text-sm font-semibold shadow-[0_6px_24px_rgba(0,0,0,.18)]" style={{ background: appearance.accent, color: accentFg }}>
                <MessageCircle className="h-[18px] w-[18px]" />
                <span className="max-w-[220px] truncate">{appearance.launcher_text}</span>
            </button>
        );
    }
    const dark = appearance.theme === "dark" || (appearance.theme === "auto" && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    return (
        <button type="button" onClick={onOpen} className={cn("inline-flex max-w-full items-center gap-2.5 rounded-full py-2 pl-2 pr-4 shadow-[0_8px_32px_rgba(0,0,0,.16)] ring-1 transition-transform hover:-translate-y-px", dark ? "bg-[#141414] text-[#f2f2f2] ring-white/10" : "bg-white text-[#111] ring-black/5")}>
            <AgentOrb seed={orbSeed} className="h-6 w-6" />
            <span className="truncate text-sm font-medium">{appearance.launcher_text}</span>
        </button>
    );
}

// ── Live preview inside the test panel ───────────────────────────────────

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
    return (
        <div className="my-auto flex flex-col items-center px-6 text-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/70 text-foreground"><HugeiconsIcon icon={Globe02Icon} className="h-5 w-5" /></span>
            <p className="max-w-[32ch] text-xs leading-5 text-muted-foreground">{children}</p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

/** What visitors get: the real widget frame, running the published version. */
export function WidgetPreview() {
    const { agent } = useAgentWorkspace();
    const basePath = useAgentsBasePath();
    const { draftAppearance } = useWidgetPreview();
    const published = !!agent.stable_version_id;
    const query = useAgentWidget(published);
    const widget = query.data?.widget ?? null;
    const appearance = draftAppearance ?? widget?.appearance ?? null;
    const frameRef = useRef<HTMLIFrameElement>(null);
    const [open, setOpen] = useState(false);
    const siteOrigin = widgetSiteOrigin();
    const websiteHref = `${basePath}/${encodeURIComponent(agent.id)}/settings`;

    const src = widget?.ready && query.data?.preview_token
        ? `${siteOrigin}/api/widget/frame/${widget.public_key}?mode=widget&preview=${encodeURIComponent(query.data.preview_token)}`
        : null;

    const pushLook = useCallback(() => {
        if (appearance) frameRef.current?.contentWindow?.postMessage({ type: "cencori:appearance", appearance }, siteOrigin);
    }, [appearance, siteOrigin]);

    // Unsaved look changes reach the frame as they're made; no reload.
    useEffect(() => { pushLook(); }, [pushLook]);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== siteOrigin || event.source !== frameRef.current?.contentWindow) return;
            const data = event.data as { type?: string } | null;
            if (data?.type === "cencori:ready") pushLook();
            if (data?.type === "cencori:close") setOpen(false);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [siteOrigin, pushLook]);

    if (!published) return <Notice>Publish the agent to see what website visitors get.</Notice>;
    if (query.isLoading) return <div className="my-auto flex justify-center text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" /></div>;
    if (query.isError || !query.data) return <Notice>{query.error instanceof Error ? query.error.message : "Could not load the widget."}</Notice>;
    if (!query.data.ready) return <Notice>{query.data.message}</Notice>;
    if (!widget || !src || !appearance) {
        return (
            <Notice action={<Button asChild size="sm" className="h-7 text-xs"><Link href={websiteHref}>Set up website widget</Link></Button>}>
                Put this agent on your website, then try it here exactly as visitors will.
            </Notice>
        );
    }

    const frame = <iframe ref={frameRef} key={src} src={src} title="Website widget preview" className="h-full w-full border-0" />;

    const left = appearance.position === "left";
    return (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[repeating-linear-gradient(135deg,transparent,transparent_12px,rgba(127,127,127,.06)_12px,rgba(127,127,127,.06)_24px)]">
            <div className={cn("absolute bottom-4 top-4 flex flex-col justify-end gap-3", left ? "left-4 right-4 items-start" : "left-4 right-4 items-end")}>
                {/* Kept mounted while closed so the conversation survives closing the chat. */}
                <div className={cn("max-h-[560px] min-h-0 w-full max-w-[400px] flex-1 overflow-hidden rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,.18)] ring-1 ring-black/10 dark:ring-white/10", !open && "hidden")}>
                    {frame}
                </div>
                {open ? (
                    <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[0_6px_24px_rgba(0,0,0,.18)]" style={{ background: appearance.accent, color: readableOn(appearance.accent) }}>
                        <X className="h-5 w-5" />
                    </button>
                ) : (
                    <WidgetLauncher appearance={appearance} orbSeed={agent.id} onOpen={() => setOpen(true)} />
                )}
            </div>
        </div>
    );
}
