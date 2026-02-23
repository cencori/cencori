"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ExternalLink,
    GitPullRequest,
    Loader2,
    MessageSquare,
    Sparkles,
} from "lucide-react";

interface ScanIssue {
    type: string;
    category?: string;
    severity: "critical" | "high" | "medium" | "low";
    name: string;
    match: string;
    line: number;
    file: string;
    description?: string;
}

interface ScanRun {
    id: string;
    status: string;
    score: string | null;
    files_scanned: number;
    issues_found: number;
    scan_duration_ms: number;
    created_at: string;
    fix_status?: "pending" | "dismissed" | "pr_opened" | "done" | "not_applicable";
    fix_pr_url?: string | null;
    fix_pr_number?: number | null;
    fix_branch_name?: string | null;
    results?: {
        issues?: ScanIssue[];
    };
}

interface ProjectSummary {
    id: string;
    github_repo_full_name: string;
    github_repo_url: string;
}

interface FixProposal {
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
    issueKey?: string;
    updatedFileContent?: string;
    aiModel?: string;
}

interface ManualGuidance {
    issueKey: string;
    issueType: string;
    issueName: string;
    severity: string;
    file: string;
    line: number;
    summary: string;
    steps: string[];
}

interface GenerateFixesResponse {
    fixes?: FixProposal[];
    totalIssues?: number;
    deterministicCount?: number;
    aiCount?: number;
    unfixableIssueCount?: number;
    manualGuidance?: ManualGuidance[];
    message?: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

const severityBadgeStyles: Record<string, string> = {
    critical: "bg-red-500/15 text-red-300 border-red-500/30",
    high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    medium: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    low: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

function issueKey(issue: Pick<ScanIssue, "file" | "line" | "type" | "name">): string {
    return `${issue.file}:${issue.line}:${issue.type}:${issue.name}`;
}

function fixIssueKey(fix: FixProposal): string {
    return `${fix.file}:${fix.line}:${fix.issueType}:${fix.issueName}`;
}

function DiffView({ original, fixed }: { original: string; fixed: string }) {
    const originalLines = original.split("\n");
    const fixedLines = fixed.split("\n");
    const max = Math.max(originalLines.length, fixedLines.length);

    return (
        <div className="rounded border border-border/40 overflow-hidden text-[11px] font-mono">
            {Array.from({ length: max }).map((_, idx) => {
                const before = originalLines[idx] ?? "";
                const after = fixedLines[idx] ?? "";

                if (before === after) {
                    return (
                        <div key={`same-${idx}`} className="px-3 py-0.5 text-muted-foreground">
                            <span className="inline-block w-4 mr-2 text-muted-foreground/50"> </span>
                            {before || " "}
                        </div>
                    );
                }

                return (
                    <div key={`diff-${idx}`}>
                        {before !== "" && (
                            <div className="px-3 py-0.5 bg-red-500/10 text-red-300">
                                <span className="inline-block w-4 mr-2 text-red-300/70">-</span>
                                {before}
                            </div>
                        )}
                        {after !== "" && (
                            <div className="px-3 py-0.5 bg-emerald-500/10 text-emerald-300">
                                <span className="inline-block w-4 mr-2 text-emerald-300/70">+</span>
                                {after}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function FixWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const scanRunId = params.scanRunId as string;

    const [loading, setLoading] = useState(true);
    const [loadingFixes, setLoadingFixes] = useState(true);
    const [creatingPr, setCreatingPr] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [showDiffs, setShowDiffs] = useState(false);
    const [project, setProject] = useState<ProjectSummary | null>(null);
    const [scanRun, setScanRun] = useState<ScanRun | null>(null);
    const [issues, setIssues] = useState<ScanIssue[]>([]);
    const [fixes, setFixes] = useState<FixProposal[]>([]);
    const [manualGuidance, setManualGuidance] = useState<ManualGuidance[]>([]);
    const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
    const [selectedIssueKey, setSelectedIssueKey] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [prInfo, setPrInfo] = useState<{ url: string; number: number } | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const hasGeneratedFixes = useRef(false);

    const fetchWorkspace = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/api/scan/projects/${projectId}/fixes/${scanRunId}`);
            if (!response.ok) {
                throw new Error("Failed to load fix workspace");
            }

            const data = await response.json();
            const fetchedScanRun = data.scanRun as ScanRun;
            const scanIssues = fetchedScanRun.results?.issues || [];

            setProject(data.project);
            setScanRun(fetchedScanRun);
            setIssues(scanIssues);
            if (scanIssues.length > 0) {
                setSelectedIssueKey(issueKey(scanIssues[0]));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load workspace");
        } finally {
            setLoading(false);
        }
    }, [projectId, scanRunId]);

    const generateFixes = useCallback(async () => {
        setLoadingFixes(true);
        setError("");
        try {
            const response = await fetch(`/api/scan/projects/${projectId}/fixes/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scanRunId }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Failed to generate fixes");
            }

            const data: GenerateFixesResponse = await response.json();
            const generatedFixes = data.fixes || [];
            setFixes(generatedFixes);
            setManualGuidance(data.manualGuidance || []);
            setSelectedFixIds(new Set(generatedFixes.map((fix) => fix.id)));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate fixes");
        } finally {
            setLoadingFixes(false);
        }
    }, [projectId, scanRunId]);

    useEffect(() => {
        fetchWorkspace();
    }, [fetchWorkspace]);

    useEffect(() => {
        if (loading || hasGeneratedFixes.current || !scanRun) return;
        hasGeneratedFixes.current = true;
        generateFixes();
    }, [generateFixes, loading, scanRun]);

    const fixMap = useMemo(() => {
        const map = new Map<string, FixProposal>();
        for (const fix of fixes) {
            map.set(fixIssueKey(fix), fix);
        }
        return map;
    }, [fixes]);

    const guidanceMap = useMemo(() => {
        const map = new Map<string, ManualGuidance>();
        for (const guidance of manualGuidance) {
            map.set(guidance.issueKey, guidance);
        }
        return map;
    }, [manualGuidance]);

    const selectedIssue = useMemo(
        () => issues.find((issue) => issueKey(issue) === selectedIssueKey) || null,
        [issues, selectedIssueKey]
    );
    const selectedIssueFix = selectedIssue ? fixMap.get(issueKey(selectedIssue)) : undefined;

    const selectedFixes = useMemo(
        () => fixes.filter((fix) => selectedFixIds.has(fix.id)),
        [fixes, selectedFixIds]
    );

    const toggleFixSelection = (fixId: string) => {
        setSelectedFixIds((prev) => {
            const next = new Set(prev);
            if (next.has(fixId)) {
                next.delete(fixId);
            } else {
                next.add(fixId);
            }
            return next;
        });
    };

    const updateWorkflowStatus = async (action: "dismiss" | "done" | "reopen") => {
        setUpdatingStatus(true);
        try {
            const response = await fetch(`/api/scan/projects/${projectId}/fixes/${scanRunId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!response.ok) return;

            const data = await response.json();
            setScanRun(data.scanRun);

            if (action === "dismiss" || action === "done") {
                router.push(`/scan/projects/${projectId}`);
            }
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleCreatePr = async () => {
        if (selectedFixes.length === 0) return;

        setCreatingPr(true);
        setError("");
        try {
            const fileTotals = fixes.reduce<Record<string, number>>((acc, fix) => {
                acc[fix.file] = (acc[fix.file] || 0) + 1;
                return acc;
            }, {});
            const fileSelected = selectedFixes.reduce<Record<string, number>>((acc, fix) => {
                acc[fix.file] = (acc[fix.file] || 0) + 1;
                return acc;
            }, {});
            const selectionByFile = Object.fromEntries(
                Object.entries(fileTotals).map(([file, total]) => [
                    file,
                    { selected: fileSelected[file] || 0, total },
                ])
            );

            const response = await fetch(`/api/scan/projects/${projectId}/fixes/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scanRunId,
                    fixes: selectedFixes,
                    selectionByFile,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create PR");
            }

            setPrInfo({ url: data.prUrl, number: data.prNumber });
            setScanRun((prev) => prev ? {
                ...prev,
                fix_status: "pr_opened",
                fix_pr_url: data.prUrl,
                fix_pr_number: data.prNumber,
                fix_branch_name: data.branchName,
            } : prev);
            window.open(data.prUrl, "_blank");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create PR");
        } finally {
            setCreatingPr(false);
        }
    };

    const handleSendChat = async () => {
        if (!chatInput.trim() || !selectedIssue || chatLoading) return;

        const userMessage: ChatMessage = { role: "user", content: chatInput.trim() };
        const nextMessages = [...chatMessages, userMessage];
        setChatMessages(nextMessages);
        setChatInput("");
        setChatLoading(true);

        try {
            const response = await fetch(`/api/scan/projects/${projectId}/fixes/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scanRunId,
                    question: userMessage.content,
                    issue: selectedIssue,
                    fix: selectedIssueFix,
                    history: nextMessages,
                }),
            });

            const data = await response.json().catch(() => ({}));
            const answer = typeof data.answer === "string" ? data.answer : "I could not generate a response.";
            setChatMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        } catch {
            setChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Chat request failed. Please try again." },
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading fix workspace...
                </div>
            </div>
        );
    }

    if (!scanRun || !project) {
        return (
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                <p className="text-sm text-red-400">{error || "Fix workspace not found."}</p>
                <Button size="sm" className="mt-4 h-7 text-xs px-3" asChild>
                    <Link href={`/scan/projects/${projectId}`}>Back to project</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-8 pb-28">
            <div className="flex items-center justify-between gap-4">
                <Link href={`/scan/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-3 w-3" />
                    Back to project
                </Link>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3"
                        onClick={() => updateWorkflowStatus("dismiss")}
                        disabled={updatingStatus}
                    >
                        {updatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : "Dismiss"}
                    </Button>
                    <Button
                        size="sm"
                        className="h-7 text-xs px-3 bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => updateWorkflowStatus("done")}
                        disabled={updatingStatus}
                    >
                        {updatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : "Done"}
                    </Button>
                </div>
            </div>

            <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-base font-medium">Fix Workspace</h1>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                        {project.github_repo_full_name}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {issues.length} issues
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {fixes.length} auto-fixable
                    </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    Review every finding, inspect diffs, ask Cencori questions, and open a PR from a new branch.
                </p>
            </div>

            {error && (
                <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                </div>
            )}

            {prInfo && (
                <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 flex items-center justify-between gap-2">
                    <span>PR #{prInfo.number} created successfully.</span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3"
                        onClick={() => window.open(prInfo.url, "_blank")}
                    >
                        <ExternalLink className="h-3 w-3 mr-1.5" />
                        Open on GitHub
                    </Button>
                </div>
            )}

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
                <div className="space-y-3">
                    {loadingFixes ? (
                        <div className="rounded-md border border-border/40 p-4 text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Generating detailed fixes...
                        </div>
                    ) : (
                        issues.map((issue) => {
                            const key = issueKey(issue);
                            const fix = fixMap.get(key);
                            const guidance = guidanceMap.get(key);
                            const selected = selectedIssueKey === key;
                            return (
                                <div
                                    key={key}
                                    className={cn(
                                        "rounded-md border p-3 transition-colors cursor-pointer",
                                        selected ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/40 bg-card/50"
                                    )}
                                    onClick={() => setSelectedIssueKey(key)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium truncate">{issue.name}</p>
                                            <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                                                {issue.file}:{issue.line}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge
                                                variant="outline"
                                                className={cn("text-[10px] h-5", severityBadgeStyles[issue.severity] || "")}
                                            >
                                                {issue.severity}
                                            </Badge>
                                            {fix ? (
                                                <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/30 text-emerald-300">
                                                    {fix.strategy === "ai" ? "AI fix" : "Auto fix"}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] h-5 border-yellow-500/30 text-yellow-300">
                                                    Manual
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <p className="mt-2 text-[11px] text-muted-foreground break-words">{issue.match}</p>
                                    {issue.description && (
                                        <p className="mt-1 text-[11px] text-muted-foreground">{issue.description}</p>
                                    )}

                                    {fix && (
                                        <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-[11px] text-emerald-200">{fix.explanation}</p>
                                                <label
                                                    className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFixIds.has(fix.id)}
                                                        onChange={() => toggleFixSelection(fix.id)}
                                                        className="h-3 w-3 rounded border-border bg-transparent"
                                                    />
                                                    Include
                                                </label>
                                            </div>
                                            {showDiffs && (
                                                <div className="mt-2">
                                                    <DiffView original={fix.originalCode} fixed={fix.fixedCode} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!fix && guidance && (
                                        <div className="mt-2 rounded border border-yellow-500/20 bg-yellow-500/5 p-2">
                                            <p className="text-[11px] text-yellow-200">{guidance.summary}</p>
                                            {guidance.steps.length > 0 && (
                                                <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground list-disc list-inside">
                                                    {guidance.steps.map((step, idx) => (
                                                        <li key={`${key}-step-${idx}`}>{step}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="rounded-md border border-border/40 bg-card/40 p-3 h-fit">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        <p className="text-xs font-medium">Ask Cencori</p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        Ask about the selected issue, exploitability, and safe remediation.
                    </p>

                    <div className="mt-3 max-h-[360px] overflow-y-auto space-y-2 pr-1">
                        {chatMessages.length === 0 ? (
                            <div className="rounded border border-border/40 p-2 text-[11px] text-muted-foreground">
                                Select an issue and ask a question to start.
                            </div>
                        ) : (
                            chatMessages.map((message, idx) => (
                                <div
                                    key={`msg-${idx}`}
                                    className={cn(
                                        "rounded border p-2 text-[11px] whitespace-pre-wrap",
                                        message.role === "assistant"
                                            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-100"
                                            : "border-border/40 bg-secondary/40 text-foreground"
                                    )}
                                >
                                    <p className="text-[10px] uppercase tracking-wide mb-1 opacity-70">
                                        {message.role}
                                    </p>
                                    {message.content}
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-3 space-y-2">
                        <Textarea
                            value={chatInput}
                            onChange={(event) => setChatInput(event.target.value)}
                            placeholder="Why is this vulnerable and what is the safest fix here?"
                            className="min-h-20 text-xs"
                        />
                        <Button
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={handleSendChat}
                            disabled={!chatInput.trim() || !selectedIssue || chatLoading}
                        >
                            {chatLoading ? (
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            ) : (
                                <Sparkles className="h-3 w-3 mr-1.5" />
                            )}
                            Ask
                        </Button>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                <div className="w-full max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-4"
                        onClick={() => setShowDiffs((prev) => !prev)}
                    >
                        {showDiffs ? "Hide Diffs" : "Show Diffs"}
                    </Button>
                    <div className="flex items-center gap-2">
                        {scanRun.fix_status === "pr_opened" && scanRun.fix_pr_url && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs px-4"
                                onClick={() => window.open(scanRun.fix_pr_url as string, "_blank")}
                            >
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                Open PR
                            </Button>
                        )}
                        <Button
                            size="sm"
                            className="h-8 text-xs px-4 bg-emerald-500 hover:bg-emerald-600"
                            onClick={handleCreatePr}
                            disabled={creatingPr || selectedFixes.length === 0}
                        >
                            {creatingPr ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <GitPullRequest className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Create PR ({selectedFixes.length})
                        </Button>
                    </div>
                </div>
            </div>

            {issues.length === 0 && (
                <div className="mt-6 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                    <span>No issues were found in this scan run. Mark as Done to return to the project.</span>
                </div>
            )}

            {!loadingFixes && issues.length > 0 && fixes.length === 0 && (
                <div className="mt-4 rounded-md border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-yellow-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <span>
                        Issues were detected, but no safe auto-fix was generated. Use the guidance cards and chat assistant for manual remediation.
                    </span>
                </div>
            )}
        </div>
    );
}
