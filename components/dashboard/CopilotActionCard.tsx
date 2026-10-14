"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CopilotActionProposal } from "@/lib/copilot/actions";

export type CopilotActionState = "pending" | "running" | "done" | "failed" | "cancelled" | "expired";

export type CopilotAction = CopilotActionProposal & {
    state: CopilotActionState;
    // Outcome line once it ran (or why it failed).
    result?: string;
};

const STATE_LABEL: Record<Exclude<CopilotActionState, "pending" | "running">, string> = {
    done: "Done",
    failed: "Failed",
    cancelled: "Cancelled",
    expired: "Not confirmed",
};

/**
 * A change Copilot proposed. Nothing runs until Confirm: then the card calls
 * the dashboard endpoint in `action.request` as the signed-in user. A new
 * API key's secret is held only in this component's state, shown once, and
 * never written to the conversation.
 */
export function CopilotActionCard({
    action,
    onUpdate,
}: {
    action: CopilotAction;
    onUpdate: (patch: Partial<CopilotAction>) => void;
}) {
    const [typed, setTyped] = useState("");
    const [secret, setSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const destructive = action.tier === "destructive";
    const phraseOk = !destructive || !action.confirmPhrase || typed.trim() === action.confirmPhrase;
    const settled = action.state !== "pending" && action.state !== "running";

    const confirm = async () => {
        if (!phraseOk || action.state !== "pending") return;
        onUpdate({ state: "running" });
        try {
            const response = await fetch(action.request.path, {
                method: action.request.method,
                headers: action.request.body ? { "Content-Type": "application/json" } : undefined,
                body: action.request.body ? JSON.stringify(action.request.body) : undefined,
            });
            const payload = await response.json().catch(() => null) as {
                error?: string;
                apiKey?: { full_key?: string };
            } | null;
            if (!response.ok) {
                onUpdate({ state: "failed", result: payload?.error || `Request failed (${response.status}).` });
                return;
            }
            if (payload?.apiKey?.full_key) setSecret(payload.apiKey.full_key);
            onUpdate({ state: "done", result: action.doneMessage });
        } catch {
            onUpdate({ state: "failed", result: "Couldn't reach the server. Nothing was changed." });
        }
    };

    const copy = async () => {
        if (!secret) return;
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard blocked; the key is still visible to copy by hand.
        }
    };

    return (
        <div
            className={cn(
                "mt-3 rounded-xl border bg-muted/40 p-4",
                destructive && action.state === "pending" ? "border-destructive/40" : "border-border/60",
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {destructive && <TriangleAlert className="h-3.5 w-3.5 text-destructive" />}
                    {action.title}
                </p>
                {settled && (
                    <span
                        className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            action.state === "done" && "bg-emerald-500/15 text-emerald-400",
                            action.state === "failed" && "bg-destructive/15 text-destructive",
                            (action.state === "cancelled" || action.state === "expired") && "bg-muted text-muted-foreground",
                        )}
                    >
                        {STATE_LABEL[action.state as keyof typeof STATE_LABEL]}
                    </span>
                )}
            </div>

            <dl className="mt-3 space-y-1.5">
                {action.details.map((row) => (
                    <div key={row.label} className="grid grid-cols-[110px_1fr] gap-3 text-[13px] leading-5">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="min-w-0 break-words text-foreground/90">{row.value}</dd>
                    </div>
                ))}
            </dl>

            {secret && (
                <div className="mt-3 rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-[11px] text-muted-foreground">Copy this key now. It won&apos;t be shown again.</p>
                    <div className="mt-2 flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{secret}</code>
                        <button
                            type="button"
                            onClick={() => void copy()}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Copy key"
                        >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                </div>
            )}

            {action.result && action.state !== "done" && (
                <p className="mt-3 text-[13px] text-muted-foreground">{action.result}</p>
            )}

            {(action.state === "pending" || action.state === "running") && (
                <div className="mt-4 space-y-3">
                    {destructive && action.confirmPhrase && (
                        <label className="block text-[12px] text-muted-foreground">
                            Type <span className="font-mono text-foreground">{action.confirmPhrase}</span> to confirm
                            <input
                                value={typed}
                                onChange={(event) => setTyped(event.target.value)}
                                disabled={action.state === "running"}
                                autoComplete="off"
                                spellCheck={false}
                                className="mt-1.5 h-8 w-full rounded-md border border-border/60 bg-background px-2.5 font-mono text-xs text-foreground outline-none focus:border-foreground/30"
                            />
                        </label>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void confirm()}
                            disabled={!phraseOk || action.state === "running"}
                            className={cn(
                                "h-7 rounded-md px-3 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
                                destructive ? "bg-destructive text-white" : "bg-foreground text-background",
                            )}
                        >
                            {action.state === "running" ? "Working…" : "Confirm"}
                        </button>
                        <button
                            type="button"
                            onClick={() => onUpdate({ state: "cancelled" })}
                            disabled={action.state === "running"}
                            className="h-7 rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
