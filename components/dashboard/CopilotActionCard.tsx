"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { Check, ChevronDown, ChevronRight, CircleAlert, CircleSlash, Clock3, Copy, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CopilotActionProposal, CopilotActionRequest } from "@/lib/copilot/actions";

export type CopilotActionState = "pending" | "running" | "done" | "failed" | "cancelled" | "expired";

export type CopilotAction = CopilotActionProposal & {
    state: CopilotActionState;
    // Outcome line once it ran (or why it failed).
    result?: string;
};

export const isOpenAction = (action: CopilotAction) => action.state === "pending" || action.state === "running";

/** Fill "{{key}}" placeholders from what earlier steps returned. */
export function fillPlaceholders<T>(value: T, vars: Record<string, string>): T {
    return JSON.parse(JSON.stringify(value).replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match)) as T;
}

/**
 * Run a confirmed action: its request, or its steps in order, as the
 * signed-in user. Ids a step returns (agent_id, version_id…) fill the next
 * steps' placeholders. Returns the outcome, and a new API key's secret when
 * the endpoint hands one back (shown once, never written to the conversation).
 */
async function runAction(action: CopilotAction): Promise<{ state: "done" | "failed"; result: string; secret?: string }> {
    const steps: CopilotActionRequest[] = action.steps?.length ? action.steps : [action.request];
    const vars: Record<string, string> = {};
    let secret: string | undefined;
    for (const [index, raw] of steps.entries()) {
        const step = fillPlaceholders(raw, vars);
        try {
            const response = await fetch(step.path, {
                method: step.method,
                headers: step.body ? { "Content-Type": "application/json" } : undefined,
                body: step.body ? JSON.stringify(step.body) : undefined,
            });
            const payload = await response.json().catch(() => null) as ({ error?: string; apiKey?: { full_key?: string } } & Record<string, unknown>) | null;
            if (!response.ok) {
                const reason = payload?.error || `Request failed (${response.status}).`;
                return { state: "failed", result: index === 0 ? reason : `${reason} (step ${index + 1} of ${steps.length}; the earlier steps went through)` };
            }
            if (payload?.apiKey?.full_key) secret = payload.apiKey.full_key;
            for (const [key, value] of Object.entries(payload ?? {})) {
                if (typeof value === "string" && /_id$/.test(key)) vars[key] = value;
            }
        } catch {
            return { state: "failed", result: index === 0 ? "Couldn't reach the server. Nothing was changed." : `Couldn't reach the server at step ${index + 1} of ${steps.length}; the earlier steps went through.` };
        }
    }
    // Ids the model needs for what comes next (e.g. the new agent's).
    const ids = Object.entries(vars).map(([key, value]) => `${key}=${value}`).join(", ");
    return { state: "done", result: ids ? `${action.doneMessage} (${ids})` : action.doneMessage, ...(secret ? { secret } : {}) };
}

/**
 * The confirmation Copilot is waiting on, docked above the composer: what
 * will change, then Confirm or Cancel (typing a phrase first for destructive
 * changes). Nothing runs until Confirm.
 */
export function CopilotActionConfirm({
    action,
    onUpdate,
    onSecret,
}: {
    action: CopilotAction;
    onUpdate: (patch: Partial<CopilotAction>) => void;
    onSecret: (secret: string) => void;
}) {
    const [typed, setTyped] = useState("");
    const destructive = action.tier === "destructive";
    const phraseOk = !destructive || !action.confirmPhrase || typed.trim() === action.confirmPhrase;
    const running = action.state === "running";

    const confirm = async () => {
        if (!phraseOk || action.state !== "pending") return;
        // A page to open (the user signs in there), not a change to run.
        if (action.link) {
            // A new tab, so the conversation stays where it is.
            window.open(action.link.href, "_blank", "noopener");
            onUpdate({ state: "done", result: action.doneMessage });
            return;
        }
        onUpdate({ state: "running" });
        const outcome = await runAction(action);
        if (outcome.secret) onSecret(outcome.secret);
        onUpdate({ state: outcome.state, result: outcome.result });
    };

    return (
        <div className={cn("mb-2 rounded-2xl border bg-background px-3.5 py-2.5 shadow-sm", destructive ? "border-destructive/40" : "border-border/50")}>
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
                        {destructive && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                        {action.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground" title={action.details.map((row) => `${row.label}: ${row.value}`).join(" · ")}>
                        {action.details.map((row) => `${row.label}: ${row.value}`).join(" · ")}
                    </p>
                </div>
                {destructive && action.confirmPhrase && (
                    <input
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") void confirm(); }}
                        disabled={running}
                        placeholder={`Type ${action.confirmPhrase}`}
                        aria-label={`Type ${action.confirmPhrase} to confirm`}
                        autoComplete="off"
                        spellCheck={false}
                        autoFocus
                        className="h-7 w-36 shrink-0 rounded-full border border-border/60 bg-background px-3 font-mono text-[11px] text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/70 focus:border-foreground/30"
                    />
                )}
                <button
                    type="button"
                    onClick={() => onUpdate({ state: "cancelled" })}
                    disabled={running}
                    className="h-7 shrink-0 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={!phraseOk || running}
                    className={cn(
                        "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
                        destructive ? "bg-destructive text-white" : "bg-foreground text-background",
                    )}
                >
                    {running && <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />}
                    {running ? "Working…" : action.link ? action.link.label : "Confirm"}
                </button>
            </div>
        </div>
    );
}

const STEP_LABEL: Record<CopilotActionState, string> = {
    pending: "Waiting for your confirmation",
    running: "Working…",
    done: "Done",
    failed: "Failed",
    cancelled: "Cancelled",
    expired: "Not confirmed",
};

/** The action as a step in the conversation: one line, details on demand. */
export function CopilotActionStep({ action }: { action: CopilotAction }) {
    const [open, setOpen] = useState(false);
    const icon = action.state === "done" ? <Check className="h-3.5 w-3.5 text-emerald-500" />
        : action.state === "failed" ? <CircleAlert className="h-3.5 w-3.5 text-destructive" />
            : action.state === "running" ? <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                : action.state === "pending" ? <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                    : <CircleSlash className="h-3.5 w-3.5 text-muted-foreground" />;
    return (
        <div className="mt-2 text-xs">
            <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="group flex w-full items-center gap-2 py-0.5 text-left text-muted-foreground transition-colors hover:text-foreground">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
                <span className={cn("text-foreground/90", (action.state === "cancelled" || action.state === "expired") && "text-muted-foreground line-through decoration-muted-foreground/40")}>{action.title}</span>
                <span className="text-muted-foreground">· {STEP_LABEL[action.state]}</span>
                {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}
            </button>
            {open && (
                <div className="ml-6 mt-1.5 space-y-1 border-l border-border/60 pl-3">
                    {action.details.map((row) => (
                        <div key={row.label} className="grid grid-cols-[110px_1fr] gap-3 leading-5">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="min-w-0 break-words text-foreground/90">{row.value}</span>
                        </div>
                    ))}
                    {action.result && <p className={cn("pt-1", action.state === "failed" ? "text-destructive" : "text-muted-foreground")}>{action.result}</p>}
                </div>
            )}
        </div>
    );
}

/** A new API key's secret, shown once above the composer until dismissed. */
export function CopilotSecret({ title, secret, onDismiss }: { title: string; secret: string; onDismiss: () => void }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard blocked; the key is still visible to copy by hand.
        }
    };
    return (
        <div className="mb-2 rounded-2xl border border-border/50 bg-background p-3.5 shadow-sm">
            <p className="text-[11px] text-muted-foreground">{title}: copy this key now. It won&apos;t be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{secret}</code>
                <button type="button" onClick={() => void copy()} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Copy key">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={onDismiss} className="h-7 shrink-0 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">I&apos;ve saved it</button>
            </div>
        </div>
    );
}
