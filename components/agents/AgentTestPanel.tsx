"use client";

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import TestTube01Icon from "@hugeicons/core-free-icons/TestTube01Icon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import { ArrowUp, Check, CircleAlert, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { ThinkingState } from "@/components/chat/ThinkingState";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
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
    const { test, busy, canManage, simpleVersion, dirty, form } = useAgentWorkspace();
    const { mode, setMode } = useWidgetPreview();
    const composerRef = useRef<HTMLTextAreaElement>(null);
    const threadRef = useRef<HTMLDivElement>(null);
    const testing = busy === "test_version";
    // "Thinking" until the reply's first words arrive, then the reply itself.
    const last = test.messages[test.messages.length - 1];
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
                                {message.tools && message.tools.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {message.tools.map((tool) => tool.status === "running" ? (
                                            <ThinkingState key={tool.id} label={`Calling ${tool.name}`} className="py-0.5 text-xs" />
                                        ) : (
                                            <span key={tool.id} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px]", tool.status === "done" ? "border-border/50 text-muted-foreground" : "border-destructive/30 text-destructive")}>
                                                {tool.status === "done" ? <Check className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                                                {tool.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {message.error ? (
                                    <p role="alert" className="flex items-start gap-2 whitespace-pre-wrap text-sm leading-6 text-destructive"><CircleAlert className="mt-1 h-4 w-4 shrink-0" />{message.content}</p>
                                ) : message.content ? (
                                    <MarkdownRenderer content={message.content} />
                                ) : null}
                                {message.content && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-foreground" onClick={() => { void navigator.clipboard.writeText(message.content); toast.success("Message copied"); }} title="Copy to clipboard">
                                    <Copy className="h-3 w-3" />
                                </Button>}
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
