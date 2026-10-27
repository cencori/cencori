"use client";

import { ThinkingState } from "@/components/chat/ThinkingState";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { ArrowUp, CornerUpLeft, Check, ChevronDown, FileText, Image as ImageIcon, Paperclip, Plus, Square, X } from "lucide-react";
import { getProviderLogoMark } from "@/components/dashboard/ProviderLogo";
import {
    COPILOT_FILE_ACCEPT,
    COPILOT_FILE_MAX_CHARS,
    COPILOT_FILES_PER_MESSAGE,
    COPILOT_IMAGE_MAX_DATA_URL_CHARS,
    COPILOT_IMAGE_MAX_EDGE,
    COPILOT_IMAGE_TYPES,
    COPILOT_IMAGES_PER_MESSAGE,
    looksLikeText,
    type CopilotFile,
} from "@/lib/copilot/files";
import { COPILOT_SPOTS, resolveCopilotHref, spotSelector, type CopilotNavigation } from "@/lib/copilot/navigation";
import { hasUnsavedChanges } from "@/lib/console/unsaved-changes";
import { HugeiconsIcon } from "@hugeicons/react";
import FullScreenIcon from "@hugeicons/core-free-icons/FullScreenIcon";
import CollapseIcon from "@hugeicons/core-free-icons/CollapseIcon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";

import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { cn } from "@/lib/utils";
import { DitherCanvas } from "@/components/dashboard/project-overview/DitherCanvas";
import { CopilotActionConfirm, CopilotActionStep, CopilotSecret, actionOutcomeNote, isOpenAction, type CopilotAction } from "@/components/dashboard/CopilotActionCard";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessPlan } from "@/components/dashboard/billing/BusinessPlan";
import {
    COPILOT_CONVERSATION_COOKIE,
    COPILOT_CONVERSATION_EVENT,
    COPILOT_NEW_CHAT_EVENT,
    COPILOT_HANDOFF_EVENT,
    COPILOT_OPEN_MENU_EVENT,
    COPILOT_HIGHLIGHT_EVENT,
    COPILOT_HEADER_ACTIONS_SLOT_ID,
    COPILOT_DEFAULT_MODEL,
    COPILOT_MODELS,
    resolveCopilotModel,
    type CopilotModelId,
} from "@/lib/console/copilot";

type AgentMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    // Changes Copilot proposed in this reply (confirmation cards).
    actions?: CopilotAction[];
    // Text files the user attached to this message.
    files?: CopilotFile[];
    // Sent to the model but not shown: the outcome of an action, so Copilot
    // carries on and reports what happened.
    hidden?: boolean;
    // The page Copilot took the user to with this reply, and where from.
    // href is empty when Copilot pointed at something on the page they were on.
    navigation?: { label: string; href: string; from: string; spot?: string; text?: string };
};

// Cards left unconfirmed in an earlier session can't be confirmed later:
// what they'd change may have moved on since.
function expireStaleActions(list: AgentMessage[]): AgentMessage[] {
    return list.map((m) => m.actions?.some((a) => a.state === "pending" || a.state === "running")
        ? {
            ...m,
            actions: m.actions.map((a) => (a.state === "pending" || a.state === "running" ? { ...a, state: "expired" as const } : a)),
        }
        : m);
}

// What the model sees of a reply: its text plus how each proposed action
// ended, so follow-ups know what actually changed.
function toAgentContent(message: AgentMessage): string {
    const outcomes = (message.actions ?? []).map((a) => `[${a.title}: ${a.state}${a.result ? ` — ${a.result}` : ""}]`);
    if (message.navigation) outcomes.push(`[Opened ${message.navigation.label}]`);
    if (!outcomes.length) return message.content;
    return [message.content, ...outcomes].filter(Boolean).join("\n");
}

type AgentProject = {
    id: string;
    name: string;
    slug: string;
} | null;

type AgentOrganization = {
    id: string;
    name: string;
    slug: string;
} | null;

interface CencoriAgentSidebarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: AgentProject;
    organization: AgentOrganization;
    environment: "production" | "test";
    userName?: string | null;
    // The conversation that was open before a refresh (from a cookie read on
    // the server). Restored on mount behind a skeleton.
    initialConversationId?: string | null;
    // "panel" docks on the right of any page; "page" is the full-screen
    // Copilot page, which fills its route and centres the conversation.
    variant?: "panel" | "page";
    // Panel only: open the full-screen Copilot page.
    onFullScreen?: () => void;
    // Page only: shrink back to the panel, on the page Copilot is taking the
    // user to (with the panel open or not), else where they came from.
    onExitFullScreen?: (to?: { href: string; openPanel: boolean }) => void;
}

// Width of the docked panel on desktop. The app layout reserves exactly this
// much room on the right while the panel is open (see app/(app)/layout.tsx).
export const AGENT_PANEL_WIDTH_CLASS = "lg:w-[520px]";

const COPILOT_MODEL_STORAGE_KEY = "cencori:copilot-model";

/** Longest edge of the preview saved with a chat. */
const THUMBNAIL_MAX_EDGE = 320;

/** Shrinks an image to fit `maxEdge` and re-encodes it as JPEG. */
async function downscaleImage(file: File, maxEdge = COPILOT_IMAGE_MAX_EDGE, quality = 0.85): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    // JPEG has no transparency: put transparent areas on white, not black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
}

/** For a business account: describe the business and Copilot builds the agent. */
const BUSINESS_PROMPTS = [
    "I run a restaurant and want guests to book tables on WhatsApp",
    "I sell clothes and want customers to order on WhatsApp",
    "I run a salon and want clients to book appointments",
    "Answer my customers' questions on my website",
];

const DEFAULT_PROMPTS = [
    "What changed in this project?",
    "Which model is most efficient?",
    "Where are the reliability risks?",
    "What should I optimize next?",
];

const AGENT_MARKDOWN_STYLES = cn(
    "text-[15px] leading-6 text-foreground/90",
    "[&_p]:my-2.5 [&_p]:text-[15px] [&_p]:leading-6 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
    "[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:leading-6",
    "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:leading-6",
    "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:leading-6",
    // Bullets and numbers flush with the paragraph edge; the text hangs after them.
    "[&_ul]:my-3 [&_ul]:list-none [&_ul]:space-y-1.5 [&_ul]:pl-0 [&_ol]:my-3 [&_ol]:list-none [&_ol]:space-y-1.5 [&_ol]:pl-0 [&_ol]:[counter-reset:item]",
    "[&_li]:my-0 [&_li]:text-[15px] [&_li]:leading-6 [&_li>p]:my-0",
    "[&_ul>li]:relative [&_ul>li]:pl-4 [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:text-muted-foreground/70 [&_ul>li]:before:content-['•']",
    "[&_ol>li]:relative [&_ol>li]:pl-5 [&_ol>li]:[counter-increment:item] [&_ol>li]:before:absolute [&_ol>li]:before:left-0 [&_ol>li]:before:text-muted-foreground/70 [&_ol>li]:before:content-[counter(item)_'.']",
    "[&_strong]:font-semibold [&_blockquote]:my-3 [&_hr]:my-4 [&_.not-prose]:my-2",
    // Tables: no outer border or padded box (prose's table margin), header as a
    // small muted caps strip, row dividers only, no column lines, aligned digits.
    "[&_table]:my-0 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] [&_table]:leading-5",
    "[&_thead]:border-0 [&_thead]:bg-muted/40 [&_tbody]:divide-y [&_tbody]:divide-border/40 [&_tr]:border-0 [&_tr:hover]:bg-transparent",
    "[&_th]:border-0 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[10px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground",
    "[&_td]:border-0 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_td]:tabular-nums [&_td]:text-foreground/85",
    "[&_div:has(>table)]:my-4 [&_div:has(>table)]:rounded-none [&_div:has(>table)]:border-0",
    // First column is the label; the rest are figures, right-aligned.
    "[&_th:not(:first-child)]:text-right [&_td:not(:first-child)]:text-right",
);

function getSurfaceLabel(pathname: string, section: string | null) {
    if (/\/agents\/[^/]+/.test(pathname)) return "Agents / Agent";
    if (pathname.includes("/agents")) return "Agents";
    if (pathname.includes("/memory")) return "Memory";
    if (pathname.includes("/copilot")) return "Copilot";
    if (pathname.startsWith("/account/")) return "Account";
    if (pathname.includes("/observability")) {
        const label = section && section !== "overview" ? section : "overview";
        return `Observability / ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
    }
    if (pathname.includes("/ai-gateway/playground")) return "AI Gateway / Playground";
    if (pathname.includes("/ai-gateway")) return "AI Gateway";
    if (pathname.includes("/logs")) return "Logs";
    if (pathname.includes("/security")) return "Security";
    if (pathname.includes("/billing")) return "Billing";
    if (pathname.includes("/settings")) return "Settings";
    return "Overview";
}

type ConversationSummary = { id: string; title: string; updated_at: string };

function timeAgo(iso: string): string {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CencoriAgentSidebar({
    open,
    onOpenChange,
    project,
    organization,
    environment,
    userName,
    initialConversationId = null,
    variant = "panel",
    onFullScreen,
    onExitFullScreen,
}: CencoriAgentSidebarProps) {
    const isPage = variant === "page";
    // On the full page, the header controls render into the dashboard top bar.
    const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
    useEffect(() => {
        if (isPage) setHeaderSlot(document.getElementById(COPILOT_HEADER_ACTIONS_SLOT_ID));
    }, [isPage]);
    // The conversation column on the full page; the panel uses its full width.
    const column = isPage ? "mx-auto w-full max-w-[760px]" : undefined;
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const surface = getSurfaceLabel(pathname, searchParams.get("section"));
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [input, setInput] = useState("");
    const [streamingContent, setStreamingContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [toolStatus, setToolStatus] = useState("Thinking");
    // The model Copilot answers with; remembered on this device.
    const [model, setModel] = useState<CopilotModelId>(COPILOT_DEFAULT_MODEL);
    useEffect(() => {
        try { setModel(resolveCopilotModel(localStorage.getItem(COPILOT_MODEL_STORAGE_KEY))); } catch { /* storage unavailable */ }
    }, []);
    const chooseModel = (id: CopilotModelId) => {
        setModel(id);
        try { localStorage.setItem(COPILOT_MODEL_STORAGE_KEY, id); } catch { /* storage unavailable */ }
    };
    const activeModel = COPILOT_MODELS.find((item) => item.id === model) ?? COPILOT_MODELS[0];

    // Files waiting to go with the next message.
    const [attachments, setAttachments] = useState<CopilotFile[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addFiles = async (list: FileList | File[]) => {
        const incoming = Array.from(list);
        const problems: string[] = [];
        const read: CopilotFile[] = [];
        for (const file of incoming) {
            if (attachments.length + read.length >= COPILOT_FILES_PER_MESSAGE) {
                problems.push(`Up to ${COPILOT_FILES_PER_MESSAGE} files per message.`);
                break;
            }
            if (COPILOT_IMAGE_TYPES.includes(file.type)) {
                const images = [...attachments, ...read].filter((item) => item.kind === "image").length;
                if (images >= COPILOT_IMAGES_PER_MESSAGE) {
                    problems.push(`Up to ${COPILOT_IMAGES_PER_MESSAGE} images per message.`);
                    continue;
                }
                const dataUrl = await downscaleImage(file).catch(() => null);
                const thumbnail = await downscaleImage(file, THUMBNAIL_MAX_EDGE, 0.7).catch(() => undefined);
                if (!dataUrl || dataUrl.length > COPILOT_IMAGE_MAX_DATA_URL_CHARS) {
                    problems.push(`${file.name} couldn't be attached.`);
                } else {
                    read.push({ name: file.name, kind: "image", content: "", dataUrl, thumbnail });
                }
                continue;
            }
            const content = await file.text().catch(() => null);
            if (content === null || !looksLikeText(content)) {
                problems.push(`${file.name} isn't a text file.`);
            } else if (content.length > COPILOT_FILE_MAX_CHARS) {
                problems.push(`${file.name} is too large (100 KB max).`);
            } else {
                read.push({ name: file.name, content });
            }
        }
        if (read.length) setAttachments((current) => [...current, ...read]);
        setFileError(problems[0] ?? null);
    };
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    // The saved conversation this chat belongs to; null until the first
    // answer is saved. A ref so sendMessage always sees the latest id.
    const conversationIdRef = useRef<string | null>(initialConversationId);
    // A new chat's id, chosen before its first answer so that answer's usage
    // can be tied to it; the conversation row is inserted with this id.
    const pendingConversationIdRef = useRef<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
    // True while the pre-refresh conversation is being fetched.
    const [restoring, setRestoring] = useState(Boolean(initialConversationId));
    const queryClient = useQueryClient();
    const historyKey = useMemo(() => ["copilotHistory", organization?.id], [organization?.id]);

    // History is per user (RLS) and per org; fetched when the panel opens.
    const { data: history = [], isFetched: historyLoaded } = useQuery({
        queryKey: historyKey,
        queryFn: async (): Promise<ConversationSummary[]> => {
            const { data, error } = await supabase
                .from("copilot_conversations")
                .select("id, title, updated_at")
                .eq("organization_id", organization!.id)
                .order("updated_at", { ascending: false })
                .limit(30);
            if (error) throw error;
            return data ?? [];
        },
        enabled: open && Boolean(organization?.id),
        staleTime: 30 * 1000,
        retry: false,
    });

    const setActiveConversation = (id: string | null) => {
        conversationIdRef.current = id;
        pendingConversationIdRef.current = null;
        setConversationId(id);
    };

    // Remember the open conversation so a refresh brings it back.
    useEffect(() => {
        document.cookie = conversationId
            ? `${COPILOT_CONVERSATION_COOKIE}=${conversationId}; path=/; max-age=31536000; samesite=lax`
            : `${COPILOT_CONVERSATION_COOKIE}=; path=/; max-age=0; samesite=lax`;
        window.dispatchEvent(new CustomEvent(COPILOT_CONVERSATION_EVENT, { detail: conversationId }));
    }, [conversationId]);

    // Restore the pre-refresh conversation once. A deleted or inaccessible
    // one quietly falls back to a new chat.
    useEffect(() => {
        if (!initialConversationId) return;
        let cancelled = false;
        void (async () => {
            const { data, error } = await supabase
                .from("copilot_conversations")
                .select("messages")
                .eq("id", initialConversationId)
                .single();
            if (cancelled) return;
            if (error || !data) {
                conversationIdRef.current = null;
                setConversationId(null);
            } else {
                setMessages(expireStaleActions((data.messages as AgentMessage[]) ?? []));
            }
            setRestoring(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [initialConversationId]);

    // Conversations already named by the title model this session.
    const titledRef = useRef<Set<string>>(new Set());

    // Ask the small title model to name a conversation, then store it. Best
    // effort: if it fails, the provisional title (first message) stays.
    const nameConversation = useCallback(async (id: string, all: AgentMessage[]) => {
        if (titledRef.current.has(id)) return;
        titledRef.current.add(id);
        try {
            const response = await fetch("/api/agent/title", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: all.map(({ role, content }) => ({ role, content })) }),
            });
            if (!response.ok) return;
            const { title } = (await response.json()) as { title?: string };
            if (!title) return;
            const { error } = await supabase.from("copilot_conversations").update({ title }).eq("id", id);
            if (error) throw error;
            void queryClient.invalidateQueries({ queryKey: historyKey });
        } catch (error) {
            console.debug("Copilot title failed:", error);
        }
    }, [historyKey, queryClient]);

    // Save after every completed answer. History is a convenience: a failed
    // save never interrupts the chat. The title is set once — provisionally
    // from the first message, then by the title model — and never overwritten
    // by later saves.
    const saveConversation = useCallback(async (all: AgentMessage[]) => {
        if (!organization?.id) return;
        const provisional = (all.find((m) => m.role === "user")?.content ?? "New chat").slice(0, 80);
        try {
            let id = conversationIdRef.current;
            let needsTitle: boolean;
            if (id) {
                const { error } = await supabase
                    .from("copilot_conversations")
                    .update({ messages: all, updated_at: new Date().toISOString() })
                    .eq("id", id);
                if (error) throw error;
                // Still on its provisional title (e.g. saved before titling existed).
                const current = history.find((item) => item.id === id)?.title;
                needsTitle = current === provisional;
            } else {
                const { data, error } = await supabase
                    .from("copilot_conversations")
                    .insert({
                        ...(pendingConversationIdRef.current ? { id: pendingConversationIdRef.current } : {}),
                        organization_id: organization.id,
                        project_id: project?.id ?? null,
                        title: provisional,
                        messages: all,
                    })
                    .select("id")
                    .single();
                if (error) throw error;
                id = data.id as string;
                conversationIdRef.current = id;
                pendingConversationIdRef.current = null;
                setConversationId(id);
                needsTitle = true;
            }
            void queryClient.invalidateQueries({ queryKey: historyKey });
            if (needsTitle && id) void nameConversation(id, all);
        } catch (error) {
            console.debug("Copilot history save failed:", error);
        }
    }, [history, historyKey, nameConversation, organization?.id, project?.id, queryClient]);

    const contextName = project?.name ?? organization?.name ?? "Cencori";
    const firstName = userName?.trim().split(/\s+/)[0];
    const displayFirstName = firstName
        ? `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}`
        : null;

    const business = useBusinessPlan(organization?.id);
    const isBusiness = business.data?.account_type === "business";
    const suggestions = useMemo(() => {
        if (isBusiness) return BUSINESS_PROMPTS;
        if (pathname.includes("/observability")) {
            return [
                "Explain the most important signal here",
                "Which model needs attention first?",
                "Where can I reduce spend safely?",
                "Summarize reliability risks",
            ];
        }
        if (pathname.includes("/ai-gateway")) {
            return [
                "Which models are active?",
                "How is gateway traffic performing?",
                "Where can I reduce latency?",
                "Show me recent delivery risks",
            ];
        }
        return DEFAULT_PROMPTS;
    }, [isBusiness, pathname]);

    useEffect(() => {
        if (!open) return;
        // Opens instantly (no slide), so focus the composer on the next frame.
        const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isPage) onOpenChange(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onOpenChange, isPage]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, streamingContent, isLoading]);

    // Switching to a different project starts a fresh chat. The first value
    // (the project loading in after a refresh) is not a switch, so it must
    // not wipe a restored conversation.
    const previousProjectRef = useRef<string | null>(project?.id ?? null);
    useEffect(() => {
        const previous = previousProjectRef.current;
        const current = project?.id ?? null;
        previousProjectRef.current = current;
        if (!previous || !current || previous === current) return;
        setMessages([]);
        setStreamingContent("");
        abortControllerRef.current?.abort();
        setIsLoading(false);
        conversationIdRef.current = null;
        pendingConversationIdRef.current = null;
        setConversationId(null);
    }, [project?.id]);

    // Take the user to a page, in this tab. The panel stays open beside it
    // (on phones, where it would cover the page, it closes); the full page
    // first hands its conversation to the panel and shrinks back into it.
    // With a spot (or a heading/button's text), it's outlined once the page
    // shows it. No href: point at something on this page.
    const goTo = useCallback((href: string, all: AgentMessage[], spot?: string, text?: string) => {
        const desktop = window.matchMedia("(min-width: 1024px)").matches;
        // Already on that page: the outline needn't wait for it to change.
        const navigating = !!href && href.split("#")[0] !== window.location.pathname + window.location.search;
        if (!href) {
            if (!isPage && !desktop) onOpenChange(false);
        } else if (isPage) {
            window.dispatchEvent(new CustomEvent(COPILOT_HANDOFF_EVENT, {
                detail: { conversationId: conversationIdRef.current, messages: all },
            }));
            onExitFullScreen?.({ href, openPanel: desktop });
        } else {
            router.push(href);
            if (!desktop) onOpenChange(false);
        }
        const selector = spot ? spotSelector(spot) : null;
        if (selector) {
            const label = COPILOT_SPOTS[spot as keyof typeof COPILOT_SPOTS].label;
            window.dispatchEvent(new CustomEvent(COPILOT_HIGHLIGHT_EVENT, { detail: { selector, label, navigating } }));
        } else if (text) {
            window.dispatchEvent(new CustomEvent(COPILOT_HIGHLIGHT_EVENT, { detail: { text, label: text, navigating } }));
        }
    }, [isPage, onExitFullScreen, onOpenChange, router]);

    // The panel picks up the conversation the full page was having.
    useEffect(() => {
        if (isPage) return;
        const onHandoff = (event: Event) => {
            const { conversationId: id, messages: handed } = (event as CustomEvent<{ conversationId: string | null; messages: AgentMessage[] }>).detail;
            abortControllerRef.current?.abort();
            conversationIdRef.current = id;
            pendingConversationIdRef.current = null;
            setConversationId(id);
            setMessages(handed);
            setStreamingContent("");
            setIsLoading(false);
            setRestoring(false);
        };
        window.addEventListener(COPILOT_HANDOFF_EVENT, onHandoff);
        return () => window.removeEventListener(COPILOT_HANDOFF_EVENT, onHandoff);
    }, [isPage]);

    // One answer from Copilot for the conversation so far (ending in a user
    // message, shown or hidden).
    const runTurn = useCallback(async (nextMessages: AgentMessage[]) => {
        const userMessage = nextMessages[nextMessages.length - 1];
        setMessages(nextMessages);
        setIsLoading(true);
        setStreamingContent("");
        setToolStatus("Thinking");

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const response = await fetch("/api/agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: nextMessages.map((message) => ({
                        role: message.role,
                        content: toAgentContent(message),
                        // Previews stay in the panel; the model gets the image or its description.
                        ...(message.files?.length ? {
                            files: message.files.map((file) => ({ name: file.name, content: file.content, kind: file.kind, dataUrl: file.dataUrl })),
                        } : {}),
                    })),
                    projectId: project?.id ?? null,
                    organizationId: organization?.id ?? null,
                    model,
                    // Ties this answer's usage (and any charge) to the conversation.
                    conversationId: conversationIdRef.current
                        ?? (pendingConversationIdRef.current ??= crypto.randomUUID()),
                    environment,
                    currentPath: `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`,
                    currentSurface: surface,
                    userName: firstName ?? null,
                    unsavedChanges: hasUnsavedChanges(),
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                const failure = new Error(payload?.error || "The agent could not answer right now.");
                // The daily cap is a plain message, not a failure.
                if (payload?.code === "copilot_daily_limit") failure.name = "CopilotLimit";
                throw failure;
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("The agent returned an empty response.");

            const decoder = new TextDecoder();
            let buffer = "";
            let sentMessages = nextMessages;
            let fullContent = "";
            const proposed: CopilotAction[] = [];
            let navigation: AgentMessage["navigation"];
            const here = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split("\n\n");
                buffer = chunks.pop() ?? "";

                for (const chunk of chunks) {
                    const line = chunk.split("\n").find((item) => item.startsWith("data: "));
                    if (!line) continue;
                    const data = line.slice(6);
                    if (data === "[DONE]") continue;
                    const payload = JSON.parse(data) as {
                        content?: string;
                        error?: string;
                        status?: string;
                        discard?: boolean;
                        action?: CopilotAction;
                        navigate?: CopilotNavigation & { confirm?: boolean };
                        openMenu?: string;
                        imageDescriptions?: CopilotFile[];
                    };
                    // Images were described: keep the descriptions, drop the
                    // image data, so the saved chat stays small.
                    if (payload.imageDescriptions?.length) {
                        const described = payload.imageDescriptions;
                        sentMessages = sentMessages.map((message) => message.id !== userMessage.id ? message : {
                            ...message,
                            files: message.files?.map((file) => {
                                const match = file.kind === "image" && file.dataUrl ? described.find((item) => item.name === file.name) : null;
                                return match ? { name: file.name, kind: "image" as const, content: match.content, thumbnail: file.thumbnail } : file;
                            }),
                        });
                        setMessages(sentMessages);
                    }
                    // A proposed change: shown as a card once the reply lands.
                    if (payload.action) proposed.push({ ...payload.action, state: "pending" });
                    // A page to take the user to: right away from the panel
                    // (it keeps talking beside the page), once the reply is in
                    // from the full page, and only once they agree if leaving
                    // would lose unsaved edits.
                    // A menu to open on screen. On phones the panel covers
                    // the screen, so it steps aside first.
                    if (payload.openMenu) {
                        const menu = payload.openMenu;
                        if (!isPage && !window.matchMedia("(min-width: 1024px)").matches) onOpenChange(false);
                        window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(COPILOT_OPEN_MENU_EVENT, { detail: menu })));
                    }
                    if (payload.navigate && !navigation) {
                        const { path, label, confirm, spot, text } = payload.navigate;
                        const href = path === null ? "" : resolveCopilotHref(path, {
                            hostname: window.location.hostname,
                            pathname,
                            organizationSlug: organization?.slug ?? null,
                            projectSlug: project?.slug ?? null,
                        });
                        if (href && confirm && path !== null) {
                            proposed.push({
                                id: crypto.randomUUID(),
                                kind: "navigate",
                                tier: "normal",
                                title: `Leave this page for ${label}?`,
                                details: [{ label: "Unsaved changes", value: "Edits you haven't saved here will be lost." }],
                                request: { method: "POST", path: "" },
                                link: { href, label: "Leave page", sameTab: true },
                                doneMessage: `Opened ${label}.`,
                                state: "pending",
                            });
                        } else if (href !== null) {
                            navigation = { label, href, from: here, ...(spot ? { spot } : {}), ...(text ? { text } : {}) };
                            if (!isPage || !href) goTo(href, [], spot, text);
                        }
                    }
                    if (payload.error) throw new Error(payload.error);
                    // The model streamed a preamble, then called tools: drop it.
                    if (payload.discard) {
                        fullContent = "";
                        setStreamingContent("");
                    }
                    // What the model is looking up right now.
                    if (payload.status) setToolStatus(payload.status);
                    if (payload.content) {
                        fullContent += payload.content;
                        setStreamingContent(fullContent);
                    }
                }
            }

            if (!fullContent.trim() && proposed.length === 0 && !navigation) throw new Error("The agent returned an empty response.");
            const finished: AgentMessage[] = [
                // Never save image data, even if a description didn't arrive.
                ...sentMessages.map((message) => message.files?.some((file) => file.dataUrl) ? {
                    ...message,
                    files: message.files.map((file) => file.dataUrl ? { name: file.name, kind: "image" as const, content: "The image could not be read.", thumbnail: file.thumbnail } : file),
                } : message),
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: fullContent,
                    ...(proposed.length ? { actions: proposed } : {}),
                    ...(navigation ? { navigation } : {}),
                },
            ];
            setMessages(finished);
            setStreamingContent("");
            if (isPage && navigation?.href) {
                // Saved first, so the panel continues the same conversation.
                await saveConversation(finished);
                goTo(navigation.href, finished, navigation.spot, navigation.text);
            } else {
                void saveConversation(finished);
            }
        } catch (error) {
            if ((error as Error).name !== "AbortError") {
                setMessages((current) => [
                    ...current,
                    {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: (error as Error).name === "CopilotLimit"
                            ? (error as Error).message
                            : `I couldn't complete that analysis. ${(error as Error).message}`,
                    },
                ]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [environment, firstName, goTo, isPage, model, onOpenChange, organization?.id, organization?.slug, pathname, project?.id, project?.slug, saveConversation, searchParams, surface]);

    const sendMessage = useCallback(async (rawContent: string) => {
        const content = rawContent.trim();
        if ((!content && attachments.length === 0) || isLoading) return;
        const userMessage: AgentMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content,
            ...(attachments.length ? { files: attachments } : {}),
        };
        setAttachments([]);
        setFileError(null);
        setInput("");
        // Moving on without answering a confirmation leaves it unconfirmed.
        await runTurn([...expireStaleActions(messages), userMessage]);
    }, [attachments, isLoading, messages, runTurn]);

    const stopGeneration = () => {
        abortControllerRef.current?.abort();
        if (streamingContent.trim()) {
            setMessages((current) => [
                ...current,
                { id: crypto.randomUUID(), role: "assistant", content: streamingContent },
            ]);
        }
        setStreamingContent("");
        setIsLoading(false);
    };

    // Latest messages for handlers that run after an await.
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    // A card was confirmed, cancelled, or finished running. Persist settled
    // states; a successful change also refreshes dashboard data.
    const updateAction = (messageId: string, actionId: string, patch: Partial<CopilotAction>) => {
        const next = messagesRef.current.map((m) => m.id !== messageId || !m.actions
            ? m
            : { ...m, actions: m.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) });
        messagesRef.current = next;
        setMessages(next);
        if (patch.state && patch.state !== "running") void saveConversation(next);
        const action = next.find((m) => m.id === messageId)?.actions?.find((a) => a.id === actionId);
        // Leaving for a page: Copilot already said where; nothing to report.
        if (action?.kind === "navigate") return;
        if (patch.state === "done") void queryClient.invalidateQueries();
        // Settled: Copilot hears how it went and reports back, like a step in a task.
        if (patch.state === "done" || patch.state === "failed" || patch.state === "cancelled") {
            if (action) void runTurn([...next, { id: crypto.randomUUID(), role: "user", content: actionOutcomeNote(action), hidden: true }]);
        }
    };
    const [revealedSecret, setRevealedSecret] = useState<{ title: string; secret: string } | null>(null);
    // The confirmation Copilot is waiting on, docked above the composer.
    const openAction = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const found = messages[i].actions?.find(isOpenAction);
            if (found) return { messageId: messages[i].id, action: found };
        }
        return null;
    })();

    const loadConversation = async (id: string) => {
        if (id === conversationIdRef.current) return;
        abortControllerRef.current?.abort();
        const { data, error } = await supabase
            .from("copilot_conversations")
            .select("messages")
            .eq("id", id)
            .single();
        if (error || !data) return;
        setActiveConversation(id);
        setMessages(expireStaleActions((data.messages as AgentMessage[]) ?? []));
        setStreamingContent("");
        setInput("");
        setIsLoading(false);
    };

    const clearConversation = () => {
        abortControllerRef.current?.abort();
        setActiveConversation(null);
        setMessages([]);
        setStreamingContent("");
        setInput("");
        setIsLoading(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    // The sidebar's "New chat" resets the full page in place.
    const clearConversationRef = useRef(clearConversation);
    clearConversationRef.current = clearConversation;
    useEffect(() => {
        if (!isPage) return;
        const onNewChat = () => clearConversationRef.current();
        window.addEventListener(COPILOT_NEW_CHAT_EVENT, onNewChat);
        return () => window.removeEventListener(COPILOT_NEW_CHAT_EVENT, onNewChat);
    }, [isPage]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void sendMessage(input);
        }
    };

    // The conversation title (doubling as the history menu) and the header
    // buttons. The panel shows both in its own bar; the full page puts just the
    // buttons in the dashboard's shared top bar, so there is one navbar, not two.
    const titleMenu = (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="flex min-w-0 max-w-[340px] items-center gap-1.5 rounded-md py-1 text-sm font-medium text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Copilot history"
            >
                {/* The open conversation's title, or "New chat" for a fresh one. */}
                {(() => {
                    const title = conversationId && history.find((item) => item.id === conversationId)?.title;
                    if (!title && (restoring || (conversationId && !historyLoaded))) {
                        return <Skeleton className="h-4 w-28" />;
                    }
                    return <span className="truncate">{title || "New chat"}</span>;
                })()}
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuItem onSelect={clearConversation} className="gap-2 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    New chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    History
                </DropdownMenuLabel>
                {history.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No past conversations yet.</p>
                ) : (
                    <div className="max-h-80 overflow-y-auto">
                        {history.map((item) => (
                            <DropdownMenuItem
                                key={item.id}
                                onSelect={() => void loadConversation(item.id)}
                                className={cn("gap-3 text-xs", item.id === conversationId && "bg-muted")}
                            >
                                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                    {timeAgo(item.updated_at)}
                                </span>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
    const headerActions = (
        <div className="flex items-center gap-1">
            <button
                type="button"
                onClick={clearConversation}
                aria-label="New chat"
                title="New chat"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <Plus className="h-4 w-4" />
            </button>
            {isPage ? (
                onExitFullScreen && (
                    <button
                        type="button"
                        onClick={() => {
                            // The panel carries on with this conversation.
                            window.dispatchEvent(new CustomEvent(COPILOT_HANDOFF_EVENT, {
                                detail: { conversationId: conversationIdRef.current, messages },
                            }));
                            onExitFullScreen();
                        }}
                        aria-label="Exit full screen"
                        title="Exit full screen"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <HugeiconsIcon icon={CollapseIcon} className="h-4 w-4" />
                    </button>
                )
            ) : (
                <>
                    {onFullScreen && (
                        <button
                            type="button"
                            onClick={onFullScreen}
                            aria-label="Open full screen"
                            title="Full screen"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <HugeiconsIcon icon={FullScreenIcon} className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        aria-label="Close copilot"
                        title="Close"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </>
            )}
        </div>
    );

    return (
        // Docked, not floating: on desktop the panel is a full-height column on
        // the right and the layout gives up the same width, so the dashboard
        // shifts over instead of being covered. Below lg there's no room to
        // shift, so it takes the full screen.
        <aside
            aria-label="Cencori copilot"
            aria-hidden={!open}
            inert={!open}
            className={cn(
                isPage
                    ? "relative flex min-h-0 flex-1 flex-col bg-background dark:bg-black"
                    : [
                        "fixed inset-x-0 top-[var(--maintenance-banner-height,0px)] bottom-0 z-50 flex flex-col bg-background dark:bg-black",
                        "lg:inset-y-0 lg:top-[var(--maintenance-banner-height,0px)] lg:left-auto lg:right-0 lg:z-40 lg:border-l lg:border-border/30",
                        AGENT_PANEL_WIDTH_CLASS,
                        open ? "translate-x-0" : "pointer-events-none translate-x-full",
                    ],
            )}
        >
            {/* The full page has no title menu: + starts a new chat and the
                sidebar's Recent chats covers history. */}
            {isPage ? (
                headerSlot && createPortal(headerActions, headerSlot)
            ) : (
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/30 pl-5 pr-3">
                    {titleMenu}
                    {headerActions}
                </div>
            )}

            {/* Dithered clouds behind the composer, fading out upward so they
                never sit behind the conversation. The palette follows the
                theme: purple dots on black in dark mode, soft lavender on white
                in light mode, each matching the panel background. Only mounted
                while open so it doesn't animate off-screen. */}
            {open && (
                <DitherCanvas
                    colors={resolvedTheme === "light" ? ["#ffffff", "#ddd0f3", "#b393e3"] : ["#000000", "#2b1150", "#5a2d91"]}
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[250px] w-full [mask-image:linear-gradient(to_top,black_45%,transparent)]"
                />
            )}

            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-6">
                {restoring ? (
                    // The pre-refresh conversation is loading.
                    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading conversation">
                        <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length === 0 && !streamingContent ? (
                    <div className={cn("flex min-h-full flex-col", column)}>
                        <div className={cn("pt-3", isPage ? "pt-10" : "max-w-[350px]")}>
                            <h2 className="text-[26px] font-medium leading-[1.12] tracking-[-0.035em] text-foreground">
                                {displayFirstName ? `Hi ${displayFirstName}` : "Hi there"}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {isBusiness
                                    ? <>I&apos;m Copilot. Tell me about your business: what you do, where you are, and what your customers usually ask. I&apos;ll build an agent that answers them for you.</>
                                    : <>I&apos;m Copilot. I&apos;ll help you manage your projects across Cencori&apos;s AI infrastructure. Let me know what you need.</>}
                            </p>
                        </div>

                        <div className="mt-8">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => void sendMessage(suggestion)}
                                    className="group flex w-full cursor-pointer items-center gap-4 rounded-md py-2.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                >
                                    <span className="flex-1 text-xs text-foreground/85 transition-colors group-hover:text-foreground">{suggestion}</span>
                                    <ArrowUp className="h-3.5 w-3.5 rotate-45 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className={cn("space-y-4", column, isPage && "px-4")}>
                        {messages.filter((message) => !message.hidden).map((message) => (
                            <article key={message.id} className={cn(message.role === "user" && "flex justify-end")}>
                                {message.role === "user" ? (
                                    <div className="flex max-w-[88%] flex-col items-end gap-1.5">
                                        {message.files?.map((file) => (
                                            file.dataUrl || file.thumbnail ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img key={file.name} src={file.dataUrl ?? file.thumbnail} alt={file.name} title={file.name} className="h-16 w-16 rounded-lg object-cover" />
                                            ) : (
                                            <span key={file.name} className="flex max-w-full items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-foreground/80">
                                                {file.kind === "image" ? (
                                                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                )}
                                                <span className="truncate">{file.name}</span>
                                            </span>
                                            )
                                        ))}
                                        {message.content && (
                                            <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm leading-5 text-background">
                                                {message.content}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="min-w-0">
                                        {message.content && (
                                            <MarkdownRenderer content={message.content} className={AGENT_MARKDOWN_STYLES} />
                                        )}
                                        {message.actions?.map((action) => <CopilotActionStep key={action.id} action={action} />)}
                                        {message.navigation && (
                                            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <span className="truncate">{message.navigation.href ? "Took you to" : "Pointed at"} <span className="text-foreground/80">{message.navigation.label}</span></span>
                                                {message.navigation.href && message.navigation.from !== `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}` && (
                                                    <>
                                                        <span aria-hidden>·</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => goTo(message.navigation!.from, messagesRef.current)}
                                                            className="inline-flex shrink-0 items-center gap-1 rounded text-foreground/70 transition-colors hover:text-foreground"
                                                        >
                                                            <CornerUpLeft className="h-3 w-3" />
                                                            Back
                                                        </button>
                                                    </>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </article>
                        ))}

                        {streamingContent && (
                            <article className="min-w-0">
                                <MarkdownRenderer content={streamingContent} className={AGENT_MARKDOWN_STYLES} />
                            </article>
                        )}
                        {isLoading && !streamingContent && <ThinkingState label={toolStatus} />}
                        <div ref={endRef} />
                    </div>
                )}
            </div>

            <div className={cn("relative px-4 pb-4 pt-3", column)}>
                {/* Same shade as the dashboard cards (bg-muted/60 over the page
                    background); the solid layer underneath keeps the dither
                    from tinting it. */}
                {revealedSecret && <CopilotSecret title={revealedSecret.title} secret={revealedSecret.secret} onDismiss={() => setRevealedSecret(null)} />}
                {openAction && (
                    <CopilotActionConfirm
                        key={openAction.action.id}
                        action={openAction.action}
                        onUpdate={(patch) => updateAction(openAction.messageId, openAction.action.id, patch)}
                        onSecret={(secret) => setRevealedSecret({ title: openAction.action.title, secret })}
                        onNavigate={(href) => goTo(href, messagesRef.current)}
                    />
                )}
                <div className="rounded-[28px] bg-background">
                    <div
                        className={cn(
                            "rounded-[28px] border border-border/25 bg-muted/60 p-2.5 transition-colors",
                            dragging && "border-foreground/30 bg-muted",
                        )}
                        onDragOver={(event) => {
                            if (!event.dataTransfer.types.includes("Files")) return;
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            if (!event.dataTransfer.files.length) return;
                            event.preventDefault();
                            setDragging(false);
                            void addFiles(event.dataTransfer.files);
                        }}
                    >
                        {(attachments.length > 0 || fileError) && (
                            <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5">
                                {attachments.map((file, index) => file.dataUrl ? (
                                    // Images: just the thumbnail, with a remove button on its corner.
                                    <span key={`${file.name}-${index}`} className="group/thumb relative h-12 w-12 shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={file.dataUrl} alt={file.name} title={file.name} className="h-12 w-12 rounded-lg object-cover" />
                                        <button
                                            type="button"
                                            aria-label={`Remove ${file.name}`}
                                            onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ) : (
                                    <span key={`${file.name}-${index}`} className="flex max-w-[220px] items-center gap-1.5 rounded-lg bg-background/70 py-1 pl-2.5 pr-1 text-xs">
                                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{file.name}</span>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${file.name}`}
                                            onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                                {fileError && <span className="text-xs text-red-500">{fileError}</span>}
                            </div>
                        )}
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Ask about ${contextName}...`}
                            rows={2}
                            className="max-h-36 min-h-[44px] w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground/60"
                        />
                        <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
                            <div className="flex items-center gap-0.5">
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept={`${COPILOT_FILE_ACCEPT},${COPILOT_IMAGE_TYPES.join(",")}`}
                                className="hidden"
                                onChange={(event) => {
                                    if (event.target.files?.length) void addFiles(event.target.files);
                                    event.target.value = "";
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Attach files"
                                title="Attach files or images"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <Paperclip className="h-4 w-4" />
                            </button>
                            {/* Business accounts' Copilot always runs on their plan's model: no picker. */}
                            {!isBusiness && <>
                            <span aria-hidden="true" className="mx-1 h-4 w-px bg-border/60" />
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={`Model: ${activeModel.label}`}
                                >
                                    {getProviderLogoMark(activeModel.provider, 14)}
                                    <span>{activeModel.label}</span>
                                    <ChevronDown className="h-3 w-3" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" side="top" className="w-56">
                                    {COPILOT_MODELS.map((item) => (
                                        <DropdownMenuItem key={item.id} onSelect={() => chooseModel(item.id)} className="gap-2 text-xs">
                                            {getProviderLogoMark(item.provider, 14)}
                                            <span className="flex-1">{item.label}</span>
                                            {item.id === model && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </>}
                            </div>
                            <button
                                type="button"
                                aria-label={isLoading ? "Stop response" : "Send message"}
                                onClick={isLoading ? stopGeneration : () => void sendMessage(input)}
                                disabled={!isLoading && !input.trim() && attachments.length === 0}
                                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-[opacity,transform] hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-25"
                            >
                                {isLoading ? <Square className="h-3 w-3 fill-current" /> : <ArrowUp className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>
                <p className="mt-2 text-center text-[9px] text-muted-foreground/70">
                    Answers are grounded in Cencori telemetry and may need verification.
                </p>
            </div>
        </aside>
    );
}
