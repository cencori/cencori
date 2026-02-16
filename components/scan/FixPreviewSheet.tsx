"use client";

import { useState, useEffect, useRef } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Loader2,
    CheckCircle,
    AlertTriangle,
    ExternalLink,
    Wand2,
    Zap,
    GitPullRequest,
    FileText,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────

export interface FixProposal {
    id: string;
    file: string;
    line: number;
    issueType: string;
    issueName: string;
    severity: string;
    strategy: "deterministic" | "ai";
    originalCode: string;
    fixedCode: string;
    explanation: string;
}

interface FixPreviewSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    scanRunId: string | null;
}

type SheetState = "generating" | "review" | "creating" | "success" | "error";

// ─── Severity Colors ────────────────────────────────────────────────────

const severityColors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

// ─── Diff Renderer ──────────────────────────────────────────────────────

function DiffView({ original, fixed }: { original: string; fixed: string }) {
    const originalLines = original.split("\n");
    const fixedLines = fixed.split("\n");

    // Simple line-by-line diff
    const maxLines = Math.max(originalLines.length, fixedLines.length);
    const diffLines: Array<{ type: "same" | "removed" | "added"; content: string }> = [];

    // Find changed lines
    const removedSet = new Set<number>();
    const addedSet = new Set<number>();

    for (let i = 0; i < maxLines; i++) {
        const orig = originalLines[i];
        const fix = fixedLines[i];
        if (orig !== fix) {
            if (orig !== undefined) removedSet.add(i);
            if (fix !== undefined) addedSet.add(i);
        }
    }

    // Build diff output
    for (let i = 0; i < originalLines.length; i++) {
        if (removedSet.has(i)) {
            diffLines.push({ type: "removed", content: originalLines[i] });
        } else {
            diffLines.push({ type: "same", content: originalLines[i] });
        }
    }

    // Insert added lines
    const result: typeof diffLines = [];
    let fixIdx = 0;
    for (const line of diffLines) {
        if (line.type === "removed") {
            result.push(line);
            // Check if there's a corresponding added line
            while (fixIdx < fixedLines.length && addedSet.has(fixIdx)) {
                result.push({ type: "added", content: fixedLines[fixIdx] });
                fixIdx++;
            }
            fixIdx++;
        } else {
            result.push(line);
            fixIdx++;
        }
    }
    // Any remaining added lines
    while (fixIdx < fixedLines.length) {
        if (addedSet.has(fixIdx)) {
            result.push({ type: "added", content: fixedLines[fixIdx] });
        }
        fixIdx++;
    }

    return (
        <div className="rounded border border-border/40 overflow-hidden text-[11px] font-mono">
            {result.map((line, i) => (
                <div
                    key={i}
                    className={`px-3 py-0.5 ${line.type === "removed"
                        ? "bg-red-500/10 text-red-300"
                        : line.type === "added"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "text-muted-foreground"
                        }`}
                >
                    <span className="inline-block w-4 text-muted-foreground/50 select-none mr-2">
                        {line.type === "removed" ? "−" : line.type === "added" ? "+" : " "}
                    </span>
                    {line.content || " "}
                </div>
            ))}
        </div>
    );
}

// ─── Fix Card ───────────────────────────────────────────────────────────

function FixCard({
    fix,
    accepted,
    onToggle,
}: {
    fix: FixProposal;
    accepted: boolean;
    onToggle: () => void;
}) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div
            className={`rounded-md border transition-colors ${accepted
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border/40 bg-card/50 opacity-60"
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-foreground truncate">
                        {fix.file}
                        <span className="text-muted-foreground">:{fix.line}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Badge
                        variant="outline"
                        className={`text-[10px] h-5 ${severityColors[fix.severity] || ""}`}
                    >
                        {fix.severity}
                    </Badge>
                    <Badge
                        variant="outline"
                        className={`text-[10px] h-5 ${fix.strategy === "ai"
                            ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
                            : "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                            }`}
                    >
                        {fix.strategy === "ai" ? (
                            <><Wand2 className="h-2.5 w-2.5 mr-1" />AI Fix</>
                        ) : (
                            <><Zap className="h-2.5 w-2.5 mr-1" />Auto Fix</>
                        )}
                    </Badge>
                    <Switch
                        checked={accepted}
                        onCheckedChange={onToggle}
                        className="scale-75"
                    />
                </div>
            </div>

            {/* Issue name + explanation */}
            <div className="px-3 pb-2">
                <p className="text-[11px] font-medium text-foreground">{fix.issueName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fix.explanation}</p>
            </div>

            {/* Expand/collapse diff */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground py-1.5 border-t border-border/30 transition-colors"
            >
                {expanded ? (
                    <><ChevronUp className="h-3 w-3" />Hide diff</>
                ) : (
                    <><ChevronDown className="h-3 w-3" />Show diff</>
                )}
            </button>

            {/* Diff view */}
            {expanded && (
                <div className="px-3 pb-3">
                    <DiffView original={fix.originalCode} fixed={fix.fixedCode} />
                </div>
            )}
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function FixPreviewSheet({
    open,
    onOpenChange,
    projectId,
    scanRunId,
}: FixPreviewSheetProps) {
    const [state, setState] = useState<SheetState>("generating");
    const [fixes, setFixes] = useState<FixProposal[]>([]);
    const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string>("");
    const [prUrl, setPrUrl] = useState<string>("");
    const [prNumber, setPrNumber] = useState<number>(0);
    const [stats, setStats] = useState({ total: 0, deterministic: 0, ai: 0 });
    const hasTriggered = useRef(false);

    // Trigger fix generation when sheet opens (useEffect is reliable, onOpenChange is not)
    useEffect(() => {
        if (open && scanRunId && !hasTriggered.current) {
            hasTriggered.current = true;
            console.log("[FixPreviewSheet] Sheet opened, triggering generateFixes");
            generateFixes();
        }
        if (!open) {
            hasTriggered.current = false;
        }
    }, [open, scanRunId]);

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            // Reset state when closing
            setState("generating");
            setFixes([]);
            setAcceptedIds(new Set());
            setError("");
            setPrUrl("");
        }
        onOpenChange(isOpen);
    };

    const generateFixes = async () => {
        setState("generating");
        setError("");

        try {
            const res = await fetch(`/api/scan/projects/${projectId}/fixes/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scanRunId }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to generate fixes");
            }

            const data = await res.json();
            setFixes(data.fixes);
            setStats({
                total: data.totalIssues,
                deterministic: data.deterministicCount,
                ai: data.aiCount,
            });

            // Accept all fixes by default
            setAcceptedIds(new Set(data.fixes.map((f: FixProposal) => f.id)));
            setState("review");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate fixes");
            setState("error");
        }
    };

    const toggleFix = (id: string) => {
        setAcceptedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (acceptedIds.size === fixes.length) {
            setAcceptedIds(new Set());
        } else {
            setAcceptedIds(new Set(fixes.map((f) => f.id)));
        }
    };

    const createPR = async () => {
        setState("creating");
        setError("");

        const acceptedFixes = fixes.filter((f) => acceptedIds.has(f.id));

        try {
            const res = await fetch(`/api/scan/projects/${projectId}/fixes/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scanRunId, fixes: acceptedFixes }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create PR");
            }

            const data = await res.json();
            setPrUrl(data.prUrl);
            setPrNumber(data.prNumber);
            setState("success");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create PR");
            setState("error");
        }
    };

    const acceptedCount = acceptedIds.size;

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-sm">
                        <GitPullRequest className="h-4 w-4 text-emerald-400" />
                        Create Fix PR
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                        {state === "generating" && "Generating fixes for detected issues..."}
                        {state === "review" && (
                            <>
                                {fixes.length} fix{fixes.length !== 1 ? "es" : ""} generated
                                {stats.deterministic > 0 && (
                                    <span className="text-cyan-400"> ({stats.deterministic} auto</span>
                                )}
                                {stats.ai > 0 && (
                                    <span className="text-violet-400">, {stats.ai} AI</span>
                                )}
                                {(stats.deterministic > 0 || stats.ai > 0) && ")"}
                                {" — "}
                                <span className="text-emerald-400">{acceptedCount} selected</span>
                            </>
                        )}
                        {state === "creating" && "Creating pull request..."}
                        {state === "success" && "Pull request created successfully!"}
                        {state === "error" && "An error occurred"}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 px-4 py-2 space-y-3">
                    {/* ─── Generating State ────────────────────────────── */}
                    {state === "generating" && (
                        <div className="space-y-3 pt-4">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                                Analyzing issues and generating fixes...
                            </div>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="rounded-md border border-border/40 p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-3.5 w-3.5 rounded" />
                                        <Skeleton className="h-3.5 w-40" />
                                        <div className="flex-1" />
                                        <Skeleton className="h-5 w-14 rounded-full" />
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </div>
                                    <Skeleton className="h-3 w-56" />
                                    <Skeleton className="h-20 w-full rounded" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ─── Review State ────────────────────────────────── */}
                    {state === "review" && fixes.length > 0 && (
                        <>
                            {/* Select all / none */}
                            <div className="flex items-center justify-between pt-1">
                                <button
                                    onClick={toggleAll}
                                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {acceptedIds.size === fixes.length ? "Deselect all" : "Select all"}
                                </button>
                                <span className="text-[11px] text-muted-foreground">
                                    {acceptedCount} of {fixes.length} selected
                                </span>
                            </div>

                            {/* Fix cards */}
                            {fixes.map((fix) => (
                                <FixCard
                                    key={fix.id}
                                    fix={fix}
                                    accepted={acceptedIds.has(fix.id)}
                                    onToggle={() => toggleFix(fix.id)}
                                />
                            ))}
                        </>
                    )}

                    {state === "review" && fixes.length === 0 && (
                        <div className="text-center py-12">
                            <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                            <p className="text-sm font-medium">No fixable issues found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                All detected issues require manual review.
                            </p>
                        </div>
                    )}

                    {/* ─── Creating PR State ───────────────────────────── */}
                    {state === "creating" && (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto mb-3" />
                            <p className="text-sm font-medium">Creating Pull Request</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Creating branch, committing fixes, and opening PR...
                            </p>
                        </div>
                    )}

                    {/* ─── Success State ───────────────────────────────── */}
                    {state === "success" && (
                        <div className="text-center py-12">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                                <GitPullRequest className="h-6 w-6 text-emerald-400" />
                            </div>
                            <p className="text-sm font-medium text-emerald-300">
                                Pull Request #{prNumber} Created
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 mb-6">
                                {acceptedCount} fix{acceptedCount !== 1 ? "es" : ""} committed. Review and merge the PR on GitHub.
                            </p>
                            <Button
                                size="sm"
                                className="h-8 text-xs px-4 bg-emerald-500 hover:bg-emerald-600"
                                onClick={() => window.open(prUrl, "_blank")}
                            >
                                <ExternalLink className="h-3 w-3 mr-1.5" />
                                View on GitHub
                            </Button>
                        </div>
                    )}

                    {/* ─── Error State ─────────────────────────────────── */}
                    {state === "error" && (
                        <div className="text-center py-12">
                            <div className="h-12 w-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="h-6 w-6 text-red-400" />
                            </div>
                            <p className="text-sm font-medium text-red-300">Something went wrong</p>
                            <p className="text-xs text-muted-foreground mt-2 mb-6">{error}</p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs px-4"
                                onClick={generateFixes}
                            >
                                Try Again
                            </Button>
                        </div>
                    )}
                </div>

                {/* ─── Footer with Create PR button ───────────────────── */}
                {state === "review" && fixes.length > 0 && (
                    <SheetFooter className="border-t border-border/40">
                        <Button
                            className="w-full h-9 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
                            disabled={acceptedCount === 0}
                            onClick={createPR}
                        >
                            <GitPullRequest className="h-3.5 w-3.5 mr-1.5" />
                            Create PR with {acceptedCount} fix{acceptedCount !== 1 ? "es" : ""}
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}
