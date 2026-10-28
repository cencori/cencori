"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { SHEET_AS_PAGE, SHEET_OVERLAY_PHONE_ONLY } from "@/components/studio/studio-sheet";
import { ArrowUp, Square, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import AirdropIcon from "@hugeicons/core-free-icons/AirdropIcon";
import { useQueryClient } from "@tanstack/react-query";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { ThinkingState } from "@/components/chat/ThinkingState";
import { CopilotActionConfirm, CopilotActionStep, CopilotSecret, actionOutcomeNote, isOpenAction, type CopilotAction } from "@/components/dashboard/CopilotActionCard";
import { getConsoleOriginForHostname } from "@/lib/console/routing";
import { cn } from "@/lib/utils";
import type { StudioContextValue } from "@/components/studio/StudioShell";
import { taskForCopilotPage, useStudioTasks, type StudioTask } from "@/components/studio/StudioTasks";

/** A random id. crypto.randomUUID exists only on secure pages (HTTPS, localhost); a phone on the dev server over plain http has getRandomValues only. */
function newId(): string {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Message = { id: string; role: "user" | "assistant"; content: string; actions?: CopilotAction[]; hidden?: boolean };

interface StudioCopilotValue {
    /** Open the sheet; with a message, send it straight away. */
    ask: (message?: string) => void;
}

const StudioCopilotContext = createContext<StudioCopilotValue | null>(null);

export function useStudioCopilot(): StudioCopilotValue {
    const value = useContext(StudioCopilotContext);
    if (!value) throw new Error("useStudioCopilot must be used inside Studio");
    return value;
}

const SUGGESTIONS = [
    "We're closed this Sunday",
    "Add a new item to the menu",
    "How many chats did we get today?",
    "Help me connect WhatsApp",
];

/**
 * Copilot in Studio: how an owner changes anything by asking. The same
 * assistant as the console's (/api/agent), in a sheet from below, with the
 * same confirm-before-change cards. The chat lasts while Studio is open.
 */
export function StudioCopilotProvider({ workspace, children }: { workspace: StudioContextValue; children: ReactNode }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState("");
    const [status, setStatus] = useState("Thinking");
    const [busy, setBusy] = useState(false);
    const [secret, setSecret] = useState<{ title: string; secret: string } | null>(null);
    const conversationId = useRef<string>(newId());
    const abort = useRef<AbortController | null>(null);
    const tasks = useStudioTasks();
    const messagesRef = useRef(messages);
    messagesRef.current = messages;
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" });
    }, [messages, streaming, busy]);

    const run = useCallback(async (next: Message[]) => {
        setMessages(next);
        setBusy(true);
        setStreaming("");
        setStatus("Thinking");
        const controller = new AbortController();
        abort.current = controller;
        let content = "";
        const proposed: CopilotAction[] = [];
        try {
            const response = await fetch("/api/agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: next.map((message) => ({
                        role: message.role,
                        content: [message.content, ...(message.actions ?? []).map((a) => `[${a.title}: ${a.state}${a.result ? ` — ${a.result}` : ""}]`)].filter(Boolean).join("\n"),
                    })),
                    projectId: workspace.project.id,
                    organizationId: workspace.organization.id,
                    conversationId: conversationId.current,
                    environment: "production",
                    currentPath: "studio",
                    currentSurface: "Studio (the business owner's phone app)",
                    userName: workspace.user.firstName,
                }),
                signal: controller.signal,
            });
            if (!response.ok || !response.body) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? "Copilot couldn't answer right now.");
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            // Console pages, menus and highlights mean nothing in Studio; those events are skipped.
            const consoleOrigin = getConsoleOriginForHostname(window.location.host.replace(/^studio\./, "")) ?? "https://console.cencori.com";
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split("\n\n");
                buffer = chunks.pop() ?? "";
                for (const chunk of chunks) {
                    const line = chunk.split("\n").find((item) => item.startsWith("data: "));
                    if (!line || line === "data: [DONE]") continue;
                    const payload = JSON.parse(line.slice(6)) as { content?: string; status?: string; discard?: boolean; error?: string; action?: CopilotAction };
                    if (payload.error) throw new Error(payload.error);
                    if (payload.status) setStatus(payload.status);
                    if (payload.discard) {
                        content = "";
                        setStreaming("");
                    }
                    if (payload.content) {
                        content += payload.content;
                        setStreaming(content);
                    }
                    if (payload.action) {
                        // A page to set something up (WhatsApp, payments…) opens as a Studio sheet
                        // over Copilot, never the console; other console links stay console links.
                        const link = payload.action.kind === "open_agent_page"
                            ? { href: `studio-task:${taskForCopilotPage(payload.action.title)}`, label: payload.action.title, sameTab: true }
                            : payload.action.link && payload.action.link.href.startsWith("/")
                                ? { ...payload.action.link, href: `${consoleOrigin}${payload.action.link.href}` }
                                : payload.action.link;
                        proposed.push({ ...payload.action, ...(link ? { link } : {}), state: "pending" });
                    }
                }
            }
            setMessages([...next, { id: newId(), role: "assistant", content, ...(proposed.length ? { actions: proposed } : {}) }]);
        } catch (error) {
            if ((error as Error).name !== "AbortError") {
                setMessages([...next, { id: newId(), role: "assistant", content: (error as Error).message }]);
            }
        } finally {
            setStreaming("");
            setBusy(false);
            abort.current = null;
        }
    }, [workspace]);

    const send = useCallback((text: string) => {
        const content = text.trim();
        if (!content || busy) return;
        setInput("");
        // Moving on without answering a confirmation leaves it unconfirmed.
        const settled = messagesRef.current.map((m) => (m.actions?.some(isOpenAction) ? { ...m, actions: m.actions.map((a) => (isOpenAction(a) ? { ...a, state: "expired" as const } : a)) } : m));
        void run([...settled, { id: newId(), role: "user", content }]);
    }, [busy, run]);

    const ask = useCallback((message?: string) => {
        setOpen(true);
        if (message) send(message);
    }, [send]);

    const updateAction = (messageId: string, actionId: string, patch: Partial<CopilotAction>) => {
        const next = messagesRef.current.map((m) => (m.id !== messageId || !m.actions ? m : { ...m, actions: m.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) }));
        messagesRef.current = next;
        setMessages(next);
        if (patch.state === "done") void queryClient.invalidateQueries();
        if (patch.state === "done" || patch.state === "failed" || patch.state === "cancelled") {
            const action = next.find((m) => m.id === messageId)?.actions?.find((a) => a.id === actionId);
            if (action) void run([...next, { id: newId(), role: "user", content: actionOutcomeNote(action), hidden: true }]);
        }
    };

    const pending = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const found = messages[i].actions?.find(isOpenAction);
            if (found) return { messageId: messages[i].id, action: found };
        }
        return null;
    })();
    const shown = messages.filter((m) => !m.hidden);

    return (
        <StudioCopilotContext.Provider value={{ ask }}>
            {children}
            <Drawer.Root open={open} onOpenChange={setOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className={`fixed inset-0 z-50 bg-transparent ${SHEET_OVERLAY_PHONE_ONLY}`} />
                    <Drawer.Content className={`dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[88svh] max-w-md lg:left-[var(--studio-sidebar,0px)] flex-col rounded-t-3xl border-t border-border/60 bg-background font-sans text-foreground outline-none ${SHEET_AS_PAGE}`}>
                        <Drawer.Title className="sr-only">Change something</Drawer.Title>
                        <Drawer.Description className="sr-only">Ask Copilot to change your assistant or answer a question about your business.</Drawer.Description>
                        <div className="flex items-center justify-between px-4 pt-3">
                            <span className="w-9" />
                            <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" />
                            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                            {shown.length === 0 && !busy ? (
                                <div className="pt-4">
                                    <h2 className="text-lg font-semibold">Change something</h2>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Say it like you&apos;d tell a member of staff.</p>
                                    <div className="mt-5 flex flex-col gap-2">
                                        {SUGGESTIONS.map((suggestion) => (
                                            <button key={suggestion} type="button" onClick={() => send(suggestion)} className="rounded-2xl border border-border/60 px-4 py-3 text-left text-sm">
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 pt-4">
                                    {shown.map((message) => message.role === "user" ? (
                                        <div key={message.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-6 text-background">{message.content}</div>
                                    ) : (
                                        <div key={message.id} className="min-w-0">
                                            {message.content && <MarkdownRenderer content={message.content} className="text-[15px] leading-6 [&_p]:my-2 [&_p:first-child]:mt-0" />}
                                            {message.actions?.map((action) => <CopilotActionStep key={action.id} action={action} />)}
                                        </div>
                                    ))}
                                    {streaming && <MarkdownRenderer content={streaming} className="text-[15px] leading-6 [&_p]:my-2 [&_p:first-child]:mt-0" />}
                                    {busy && !streaming && <ThinkingState label={status} />}
                                </div>
                            )}
                            <div ref={endRef} />
                        </div>
                        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                            {secret && <CopilotSecret title={secret.title} secret={secret.secret} onDismiss={() => setSecret(null)} />}
                            {pending && (
                                <CopilotActionConfirm
                                    key={pending.action.id}
                                    action={pending.action}
                                    onUpdate={(patch) => updateAction(pending.messageId, pending.action.id, patch)}
                                    onSecret={(value) => setSecret({ title: pending.action.title, secret: value })}
                                    onNavigate={(href) => { if (href.startsWith("studio-task:")) tasks.open(href.slice("studio-task:".length) as StudioTask); }}
                                />
                            )}
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    send(input);
                                }}
                                className="flex items-center gap-2"
                            >
                                <label className="flex h-12 flex-1 items-center rounded-full bg-muted px-4">
                                    <span className="sr-only">What should change?</span>
                                    <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="What should change?" className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
                                </label>
                                {busy ? (
                                    <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                                        <Square className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button type="submit" disabled={!input.trim()} aria-label="Send" className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background", !input.trim() && "opacity-40")}>
                                        <ArrowUp className="h-5 w-5" />
                                    </button>
                                )}
                            </form>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </StudioCopilotContext.Provider>
    );
}

/** Copilot's button beside the tabs: one tap into Copilot. */
export function StudioAskBar() {
    const { ask } = useStudioCopilot();
    return (
        // A round button beside the tabs, as tall as their pill.
        <button
            type="button"
            onClick={() => ask()}
            aria-label="Ask or change anything"
            className="flex size-[58px] shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground backdrop-blur-md"
        >
            {/* The console's Copilot icon. */}
            <HugeiconsIcon icon={AirdropIcon} aria-hidden className="size-5" />
        </button>
    );
}
