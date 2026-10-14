"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { ArrowUp, ChevronDown, Plus, Square, X } from "lucide-react";

import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { cn } from "@/lib/utils";
import { DitherCanvas } from "@/components/dashboard/project-overview/DitherCanvas";
import { CopilotActionCard, type CopilotAction } from "@/components/dashboard/CopilotActionCard";
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
import { COPILOT_CONVERSATION_COOKIE } from "@/lib/console/copilot";

type AgentMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    // Changes Copilot proposed in this reply (confirmation cards).
    actions?: CopilotAction[];
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
    if (!message.actions?.length) return message.content;
    const outcomes = message.actions.map((a) => `[${a.title}: ${a.state}${a.result ? ` — ${a.result}` : ""}]`);
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
}

// Width of the docked panel on desktop. The app layout reserves exactly this
// much room on the right while the panel is open (see app/(app)/layout.tsx).
export const AGENT_PANEL_WIDTH_CLASS = "lg:w-[520px]";

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
    "[&_ul]:my-3 [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:space-y-1.5 [&_ol]:pl-5",
    "[&_li]:my-0 [&_li]:pl-0.5 [&_li]:text-[15px] [&_li]:leading-6 [&_li>p]:my-0 [&_li::marker]:text-muted-foreground/70",
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

function ThinkingState({ label = "Thinking" }: { label?: string }) {
    return (
        <div className="py-3 text-[15px]" role="status" aria-live="polite">
            <span key={label} className="agent-thinking-shimmer" data-text={label}>{label}</span>
        </div>
    );
}

export function CencoriAgentSidebar({
    open,
    onOpenChange,
    project,
    organization,
    environment,
    userName,
    initialConversationId = null,
}: CencoriAgentSidebarProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { resolvedTheme } = useTheme();
    const surface = getSurfaceLabel(pathname, searchParams.get("section"));
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [input, setInput] = useState("");
    const [streamingContent, setStreamingContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [toolStatus, setToolStatus] = useState("Thinking");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    // The saved conversation this chat belongs to; null until the first
    // answer is saved. A ref so sendMessage always sees the latest id.
    const conversationIdRef = useRef<string | null>(initialConversationId);
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
        setConversationId(id);
    };

    // Remember the open conversation so a refresh brings it back.
    useEffect(() => {
        document.cookie = conversationId
            ? `${COPILOT_CONVERSATION_COOKIE}=${conversationId}; path=/; max-age=31536000; samesite=lax`
            : `${COPILOT_CONVERSATION_COOKIE}=; path=/; max-age=0; samesite=lax`;
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
                    .insert({ organization_id: organization.id, project_id: project?.id ?? null, title: provisional, messages: all })
                    .select("id")
                    .single();
                if (error) throw error;
                id = data.id as string;
                conversationIdRef.current = id;
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

    const suggestions = useMemo(() => {
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
    }, [pathname]);

    useEffect(() => {
        if (!open) return;
        // Opens instantly (no slide), so focus the composer on the next frame.
        const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onOpenChange(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onOpenChange]);

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
        setConversationId(null);
    }, [project?.id]);

    const sendMessage = useCallback(async (rawContent: string) => {
        const content = rawContent.trim();
        if (!content || isLoading) return;

        const userMessage: AgentMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content,
        };
        const nextMessages = [...messages, userMessage];

        setMessages(nextMessages);
        setInput("");
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
                    })),
                    projectId: project?.id ?? null,
                    organizationId: organization?.id ?? null,
                    environment,
                    currentPath: `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`,
                    currentSurface: surface,
                    userName: firstName ?? null,
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
            let fullContent = "";
            const proposed: CopilotAction[] = [];

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
                    };
                    // A proposed change: shown as a card once the reply lands.
                    if (payload.action) proposed.push({ ...payload.action, state: "pending" });
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

            if (!fullContent.trim() && proposed.length === 0) throw new Error("The agent returned an empty response.");
            const finished: AgentMessage[] = [
                ...nextMessages,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: fullContent,
                    ...(proposed.length ? { actions: proposed } : {}),
                },
            ];
            setMessages(finished);
            setStreamingContent("");
            void saveConversation(finished);
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
    }, [environment, firstName, isLoading, messages, organization?.id, pathname, project?.id, saveConversation, searchParams, surface]);

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
        if (patch.state === "done") void queryClient.invalidateQueries();
    };

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

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void sendMessage(input);
        }
    };

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
                "fixed inset-0 z-50 flex flex-col bg-background dark:bg-black",
                "lg:inset-y-0 lg:left-auto lg:right-0 lg:z-40 lg:border-l lg:border-border/30",
                AGENT_PANEL_WIDTH_CLASS,
                open ? "translate-x-0" : "pointer-events-none translate-x-full",
            )}
        >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/30 pl-5 pr-3">
                {/* The title doubles as the history menu. */}
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
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        aria-label="Close copilot"
                        title="Close"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

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
                    // The pre-refresh conversation is loading: hold its place.
                    <div className="space-y-5" role="status" aria-label="Loading conversation">
                        <div className="flex justify-end">
                            <Skeleton className="h-10 w-40 rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-11/12" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                        <div className="flex justify-end">
                            <Skeleton className="h-10 w-52 rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    </div>
                ) : messages.length === 0 && !streamingContent ? (
                    <div className="flex min-h-full flex-col">
                        <div className="max-w-[350px] pt-3">
                            <h2 className="text-[26px] font-medium leading-[1.12] tracking-[-0.035em] text-foreground">
                                {displayFirstName ? `What should we inspect, ${displayFirstName}?` : "What should we inspect?"}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Ask about traffic, models, spend, latency, security, or anything visible in this workspace.
                            </p>
                        </div>

                        <div className="mt-10 border-t border-border/35">
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => void sendMessage(suggestion)}
                                    className="group flex w-full cursor-pointer items-center gap-4 border-b border-border/35 py-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                >
                                    <span className="font-mono text-[10px] text-muted-foreground/60">0{index + 1}</span>
                                    <span className="flex-1 text-xs text-foreground/85 transition-colors group-hover:text-foreground">{suggestion}</span>
                                    <ArrowUp className="h-3.5 w-3.5 rotate-45 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <article key={message.id} className={cn(message.role === "user" && "flex justify-end")}>
                                {message.role === "user" ? (
                                    <div className="max-w-[88%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm leading-5 text-background">
                                        {message.content}
                                    </div>
                                ) : (
                                    <div className="min-w-0">
                                        {message.content && (
                                            <MarkdownRenderer content={message.content} className={AGENT_MARKDOWN_STYLES} />
                                        )}
                                        {message.actions?.map((action) => (
                                            <CopilotActionCard
                                                key={action.id}
                                                action={action}
                                                onUpdate={(patch) => updateAction(message.id, action.id, patch)}
                                            />
                                        ))}
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

            <div className="relative px-4 pb-4 pt-3">
                {/* Same shade as the dashboard cards (bg-muted/60 over the page
                    background); the solid layer underneath keeps the dither
                    from tinting it. */}
                <div className="rounded-[22px] bg-background">
                    <div className="rounded-[22px] border border-border/55 bg-muted/60 p-2.5 transition-colors focus-within:border-foreground/30">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Ask about ${contextName}...`}
                            rows={3}
                            className="max-h-36 min-h-[64px] w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground/60"
                        />
                        <div className="flex items-center justify-end px-1 pb-0.5">
                            <button
                                type="button"
                                aria-label={isLoading ? "Stop response" : "Send message"}
                                onClick={isLoading ? stopGeneration : () => void sendMessage(input)}
                                disabled={!isLoading && !input.trim()}
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
