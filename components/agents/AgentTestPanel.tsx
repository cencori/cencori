"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import TestTube01Icon from "@hugeicons/core-free-icons/TestTube01Icon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import ToolsIcon from "@hugeicons/core-free-icons/ToolsIcon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import { ArrowUp, CircleAlert, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { ThinkingState } from "@/components/chat/ThinkingState";
import { useAgentWorkspace, type TestMessage, type TestStep, type ToolActivity } from "@/components/agents/AgentWorkspace";
import { WidgetPreview, useWidgetPreview, type TestPanelMode } from "@/components/agents/widget-preview";
import { cn } from "@/lib/utils";

const MODES: Array<{ value: TestPanelMode; label: string }> = [
    { value: "draft", label: "Draft" },
    { value: "widget", label: "Widget" },
];

/**
 * The test panel docked on the right of every agent page. Draft chats with
 * the version open in the workspace, published or not, privately; Widget
 * runs the real website widget, which serves the published version.
 */
export function AgentTestPanel({ onClose }: { onClose: () => void }) {
    const { test, busy, canManage, simpleVersion, dirty, form, version } = useAgentWorkspace();
    const { mode, setMode } = useWidgetPreview();
    const composerRef = useRef<HTMLTextAreaElement>(null);
    const threadRef = useRef<HTMLDivElement>(null);
    const testing = busy === "test_version";
    // "Thinking" until the reply's first words arrive, then the reply itself.
    const last = test.messages[test.messages.length - 1];
    // MCP tools reach the model as "<server>__<tool>": show the tool with its server's logo.
    // Connected apps' tools are named "<app id>__<action>" the same way.
    const mcpServers = [
        ...((version?.config_json.mcp_servers ?? []) as Array<{ name?: string; icon?: string }>)
            .filter((server) => typeof server?.name === "string")
            .map((server) => ({ prefix: `${server.name!.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20)}__`, icon: server.icon })),
        ...((version?.config_json.integrations ?? []) as Array<{ icon?: string; nango?: { integration?: string } }>)
            .filter((app) => typeof app?.nango?.integration === "string")
            .map((app) => ({ prefix: `${app.nango!.integration}__`, icon: app.icon })),
    ];
    const mcpToolLabel = (name: string): { tool: string; icon?: string } | null => {
        for (const server of mcpServers) {
            if (name.startsWith(server.prefix)) return { tool: name.slice(server.prefix.length), icon: server.icon };
        }
        return null;
    };
    // Also between a finished tool call and the words that follow it.
    const waiting = testing && (last?.role === "user" || (!last?.content && !last?.tools?.some((tool) => tool.status === "running")));
    const canSend = canManage && !busy && !!form.model && !!test.input.trim();

    useEffect(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    }, [test.messages, busy]);

    // "Start a conversation" elsewhere on the page focuses the composer.
    useEffect(() => {
        if (test.focusRequest > 0) composerRef.current?.focus();
    }, [test.focusRequest]);

    const resize = () => {
        if (!composerRef.current) return;
        composerRef.current.style.height = "auto";
        composerRef.current.style.height = `${composerRef.current.scrollHeight}px`;
    };

    const send = () => {
        void test.run();
        if (composerRef.current) composerRef.current.style.height = "auto";
    };

    return (
        <aside aria-label="Preview agent" className="flex min-h-0 w-full flex-col border-l border-border/40 bg-background">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/40 pl-3 pr-2">
                <div role="tablist" aria-label="Test mode" className="grid grid-cols-2 rounded-md bg-muted/60 p-0.5 text-xs">
                    {MODES.map((item) => (
                        <button key={item.value} type="button" role="tab" aria-selected={mode === item.value} onClick={() => setMode(item.value)} className={cn("rounded px-2.5 py-1 transition-colors", mode === item.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    {mode === "draft" && simpleVersion && canManage && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => { test.reset(); composerRef.current?.focus(); }} disabled={!!busy} aria-label="New conversation" title="New conversation" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                            <HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close preview" title="Close" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {mode === "widget" ? (
                <div className="flex min-h-0 flex-1 flex-col"><WidgetPreview /></div>
            ) : !simpleVersion ? (
                <p className="m-4 rounded-md border border-amber-500/25 p-4 text-xs leading-5 text-amber-500">This agent has advanced capabilities. Test this version through the API for now.</p>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                    <div ref={threadRef} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-5">
                        {test.messages.length === 0 && !testing && (
                            <div className="my-auto flex flex-col items-center px-4 text-center">
                                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/70 text-foreground"><HugeiconsIcon icon={TestTube01Icon} className="h-5 w-5" /></span>
                                <h3 className="text-sm font-medium">Try this agent</h3>
                                <p className="mt-1 max-w-[30ch] text-xs leading-5 text-muted-foreground">A private test. No customer data or connected apps are used.</p>
                            </div>
                        )}
                        {test.messages.map((message) => message.role === "user" ? (
                            <div key={message.id} className="flex justify-end">
                                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-primary-foreground">
                                    <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed">{message.content}</p>
                                </div>
                            </div>
                        ) : (
                            <div key={message.id} className="min-w-0 space-y-1.5">
                                {(() => {
                                    if (message.error) {
                                        return <p role="alert" className="flex items-start gap-2 whitespace-pre-wrap text-xs leading-relaxed text-destructive"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{message.content}</p>;
                                    }
                                    const { trace, answer } = splitReply(message);
                                    return (
                                        <>
                                            {trace.length > 0 && (
                                                <WorkTrace
                                                    steps={trace}
                                                    tools={message.tools ?? []}
                                                    live={testing && message.id === last?.id}
                                                    startedAt={message.startedAt}
                                                    durationMs={message.durationMs}
                                                    toolLabel={mcpToolLabel}
                                                />
                                            )}
                                            {answer && <MarkdownRenderer content={answer} className={REPLY_TEXT} />}
                                        </>
                                    );
                                })()}
                                {message.content && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-foreground" onClick={() => { void navigator.clipboard.writeText(splitReply(message).answer || message.content); toast.success("Message copied"); }} title="Copy to clipboard">
                                    <Copy className="h-3 w-3" />
                                </Button>}
                                {message.ended && (
                                    <div className="flex items-center gap-3 pt-2 text-[11px] text-muted-foreground">
                                        <span className="h-px flex-1 bg-border/60" />
                                        Conversation ended · your next message starts a new one
                                        <span className="h-px flex-1 bg-border/60" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {waiting && <ThinkingState className="py-1 text-sm" />}
                    </div>
                    <div className="shrink-0 px-3 pb-3">
                        {dirty && <p className="mb-2 px-1 text-[11px] leading-4 text-muted-foreground">Unsaved changes are saved before the test runs.</p>}
                        {!form.model && <p className="mb-2 px-1 text-[11px] leading-4 text-muted-foreground">Choose a model to start testing.</p>}
                        <div className="rounded-[22px] border border-border/25 bg-muted/60 p-2.5">
                            <textarea
                                ref={composerRef}
                                value={test.input}
                                onChange={(event) => { test.setInput(event.target.value); resize(); }}
                                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }}
                                placeholder="Ask this agent to do something its customers would ask..."
                                rows={2}
                                disabled={testing}
                                className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 outline-none placeholder:text-muted-foreground/60"
                            />
                            <div className="flex justify-end px-1">
                                <Button type="button" size="icon" onClick={send} disabled={!canSend} aria-label="Send message" className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-25">
                                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className={cn("h-4 w-4")} />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

// Replies match the user's bubble: the renderer's prose defaults are 16px.
const REPLY_TEXT = "text-xs font-medium leading-relaxed [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-2 [&_ul]:my-2";

/**
 * The reply's last run of text is the answer; everything before it (tool
 * calls and what the agent said between them) is the work that led there.
 */
function splitReply(message: TestMessage): { trace: TestStep[]; answer: string } {
    const steps: TestStep[] = message.steps
        ?? [...(message.tools ?? []).map((tool): TestStep => ({ type: "tool", id: tool.id })), ...(message.content ? [{ type: "text", text: message.content } as TestStep] : [])];
    if (!steps.some((step) => step.type === "tool")) return { trace: [], answer: message.content };
    const tail = steps[steps.length - 1];
    return tail?.type === "text"
        ? { trace: steps.slice(0, -1), answer: tail.text.trim() }
        : { trace: steps, answer: "" };
}

function formatDuration(ms: number): string {
    const seconds = Math.max(1, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return seconds % 60 ? `${minutes}m ${seconds % 60}s` : `${minutes}m`;
}

/**
 * The agent's steps in the order it took them, after Tensor's work trace:
 * open and ticking while the turn runs, then folded into "Worked for 4s"
 * once the answer lands. A failed call keeps it open so the failure shows.
 */
function WorkTrace({ steps, tools, live, startedAt, durationMs, toolLabel }: {
    steps: TestStep[];
    tools: ToolActivity[];
    live: boolean;
    startedAt?: number;
    durationMs?: number;
    toolLabel: (name: string) => { tool: string; icon?: string } | null;
}) {
    const failed = tools.some((tool) => tool.status === "failed");
    const [expanded, setExpanded] = useState(live || failed);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        setExpanded(live || failed);
    }, [live, failed]);
    useEffect(() => {
        if (!live) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [live]);

    const elapsed = durationMs ?? (startedAt ? now - startedAt : null);
    const toolsById = new Map(tools.map((tool) => [tool.id, tool]));

    return (
        <section className="text-xs">
            {live ? (
                <p className="py-0.5 text-muted-foreground">Working{elapsed !== null ? ` for ${formatDuration(elapsed)}` : ""}</p>
            ) : (
                <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="group inline-flex items-center gap-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground">
                    <span>{elapsed !== null ? `Worked for ${formatDuration(elapsed)}` : "Work details"}</span>
                    <HugeiconsIcon icon={expanded ? ArrowDown01Icon : ArrowRight01Icon} size={12} strokeWidth={1.75} aria-hidden />
                </button>
            )}
            {expanded && (
                <ol className="mt-1.5 space-y-1.5 border-l border-border/60 pl-3">
                    {steps.map((step, index) => {
                        if (step.type === "text") {
                            if (!step.text.trim()) return null;
                            return (
                                <li key={`text-${index}`} className="text-muted-foreground">
                                    <MarkdownRenderer content={step.text.trim()} className={cn(REPLY_TEXT, "font-normal text-muted-foreground [&_p]:my-0")} />
                                </li>
                            );
                        }
                        const tool = toolsById.get(step.id);
                        if (!tool) return null;
                        const label = toolLabel(tool.name);
                        const name = label?.tool ?? tool.name;
                        const icon = label?.icon
                            // eslint-disable-next-line @next/next/no-img-element -- a stored data URL
                            ? <img src={label.icon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain" />
                            : <HugeiconsIcon icon={ToolsIcon} size={14} strokeWidth={1.5} className="shrink-0" aria-hidden />;
                        return (
                            <li key={tool.id} title={tool.name} className={cn("flex items-center gap-1.5", tool.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                                {tool.status === "failed" ? <CircleAlert className="h-3.5 w-3.5 shrink-0" /> : icon}
                                {tool.status === "running"
                                    ? <ThinkingState label={`Using ${name}`} className="text-xs" />
                                    : <span>{tool.status === "failed" ? `${name} failed` : `Used ${name}`}</span>}
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
