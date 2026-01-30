"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Shield,
    GitBranch,
    Settings,
    Play,
    CheckCircle,
    AlertTriangle,
    Clock,
    FileText,
    ChevronRight,
    Zap,
    Loader2,
    ArrowLeft,
    Trash2,
    Copy,
    Download
} from "lucide-react";
import Link from "next/link";

interface ScanProject {
    id: string;
    github_repo_full_name: string;
    github_repo_url: string;
    last_scan_at: string | null;
    last_scan_score: string | null;
    last_scan_issues: number;
    last_scan_files: number;
    auto_scan_enabled: boolean;
    slack_webhook_url: string | null;
    discord_webhook_url: string | null;
}

interface ScanIssue {
    type: string;
    severity: string;
    name: string;
    match: string;
    line: number;
    file: string;
}

interface ScanRun {
    id: string;
    slug?: string;
    created_at: string;
    status: string;
    score: string | null;
    files_scanned: number;
    issues_found: number;
    scan_duration_ms: number;
    results?: { issues: ScanIssue[] };
    logs?: Array<{ type: string; time: number; message?: string; data?: unknown }>;
}

interface Changelog {
    id: string;
    project_id: string;
    title: string | null;
    markdown: string;
    period_start: string;
    period_end: string;
    commit_count: number;
    created_at: string;
}

const scoreColors: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-blue-500",
    C: "bg-yellow-500",
    D: "bg-orange-500",
    F: "bg-red-500",
};

const severityColors: Record<string, string> = {
    critical: "text-red-500",
    high: "text-orange-500",
    medium: "text-yellow-500",
    low: "text-blue-400",
};

function formatTimeAgo(dateString: string | null): string {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [isGeneratingChangelog, setIsGeneratingChangelog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [project, setProject] = useState<ScanProject | null>(null);
    const [scans, setScans] = useState<ScanRun[]>([]);
    const [currentScan, setCurrentScan] = useState<ScanRun | null>(null);
    const [scanLog, setScanLog] = useState<Array<{ type: string; message: string; time?: string; severity?: string; line?: number }>>([]);
    const [changelogs, setChangelogs] = useState<Changelog[]>([]);
    const [selectedChangelog, setSelectedChangelog] = useState<Changelog | null>(null);

    const handleCopyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDeleteProject = async () => {
        if (!project) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/scan/projects/${projectId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                router.push('/scan');
            } else {
                const data = await response.json();
                console.error('Failed to delete project:', data.error);
            }
        } catch (err) {
            console.error('Error deleting project:', err);
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    // Changelog timeframe options
    const [changelogTimeframe, setChangelogTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
    const timeframeLabels: Record<string, string> = {
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days',
    };
    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await fetch(`/api/scan/projects/${projectId}`);
                if (response.ok) {
                    const data = await response.json();
                    setProject(data.project);
                    setScans(data.scans || []);
                    if (data.scans && data.scans.length > 0) {
                        const lastScan = data.scans[0];
                        setCurrentScan(lastScan);

                        // Populate scan log from last scan's results
                        if (lastScan.results?.issues && lastScan.results.issues.length > 0) {
                            const logEntries: Array<{ type: string; message: string; time?: string; severity?: string; line?: number }> = [];
                            const timeStr = `${(lastScan.scan_duration_ms / 1000).toFixed(1)}s`;

                            // Group issues by file
                            const issuesByFile: Record<string, ScanIssue[]> = {};
                            for (const issue of lastScan.results.issues) {
                                if (!issuesByFile[issue.file]) {
                                    issuesByFile[issue.file] = [];
                                }
                                issuesByFile[issue.file].push(issue);
                            }

                            // Add file and issue entries
                            for (const [file, issues] of Object.entries(issuesByFile)) {
                                logEntries.push({ type: "file", message: file, time: timeStr });
                                for (const issue of issues) {
                                    logEntries.push({
                                        type: "issue",
                                        message: `${issue.name}: ${issue.match}`,
                                        severity: issue.severity,
                                        line: issue.line,
                                    });
                                }
                            }

                            // Add summary
                            logEntries.push({
                                type: "summary",
                                message: `Complete: ${lastScan.files_scanned} files scanned, ${lastScan.issues_found} issues found`,
                                time: timeStr,
                            });

                            setScanLog(logEntries);
                        } else if (lastScan.status === 'completed') {
                            // No issues found, show success
                            const timeStr = `${(lastScan.scan_duration_ms / 1000).toFixed(1)}s`;
                            setScanLog([{
                                type: "summary",
                                message: `Complete: ${lastScan.files_scanned} files scanned, 0 issues found`,
                                time: timeStr,
                            }]);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching project:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProject();
    }, [projectId]);

    // Fetch changelogs
    useEffect(() => {
        const fetchChangelogs = async () => {
            try {
                const response = await fetch(`/api/scan/projects/${projectId}/changelog`);
                if (response.ok) {
                    const data = await response.json();
                    setChangelogs(data.changelogs || []);
                }
            } catch (err) {
                console.error('Error fetching changelogs:', err);
            }
        };
        fetchChangelogs();
    }, [projectId]);

    const handleGenerateChangelog = async () => {
        if (!project) return;

        // Map timeframe to since string
        const sinceMap: Record<string, string> = {
            '24h': '1 day ago',
            '7d': '1 week ago',
            '30d': '1 month ago',
        };

        setIsGeneratingChangelog(true);
        try {
            const response = await fetch(`/api/scan/projects/${projectId}/changelog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ since: sinceMap[changelogTimeframe] }),
            });

            if (response.ok) {
                const data = await response.json();
                setChangelogs(prev => [data.changelog, ...prev]);
                setSelectedChangelog(data.changelog);
            }
        } catch (err) {
            console.error('Error generating changelog:', err);
        } finally {
            setIsGeneratingChangelog(false);
        }
    };

    const handleRunScan = async () => {
        if (!project) return;

        setIsScanning(true);
        setScanLog([]);

        try {
            // Use SSE streaming endpoint
            const eventSource = new EventSource(`/api/scan/projects/${projectId}/scan/stream`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const timeStr = `${(data.time / 1000).toFixed(1)}s`;

                    if (data.type === 'start') {
                        setScanLog([{ type: "info", message: data.message, time: timeStr }]);
                    } else if (data.type === 'success') {
                        setScanLog(prev => [...prev, { type: "success", message: data.message, time: timeStr }]);
                    } else if (data.type === 'info') {
                        setScanLog(prev => [...prev, { type: "info", message: data.message, time: timeStr }]);
                    } else if (data.type === 'progress') {
                        // Update last progress entry or add new one
                        setScanLog(prev => {
                            const lastIndex = prev.findIndex(l => l.type === 'progress');
                            if (lastIndex >= 0) {
                                const updated = [...prev];
                                updated[lastIndex] = { type: "info", message: data.message, time: timeStr };
                                return updated;
                            }
                            return [...prev, { type: "info", message: data.message, time: timeStr }];
                        });
                    } else if (data.type === 'issue') {
                        // Add file and issues to log
                        const issueData = data.data;
                        setScanLog(prev => [
                            ...prev,
                            { type: "file", message: issueData.file, time: timeStr },
                            ...issueData.issues.map((issue: ScanIssue) => ({
                                type: "issue",
                                message: `${issue.name}: ${issue.match}`,
                                severity: issue.severity,
                                line: issue.line,
                            }))
                        ]);
                    } else if (data.type === 'complete') {
                        const result = data.data;
                        setScanLog(prev => [...prev, {
                            type: "summary",
                            message: `Complete: ${result.filesScanned} files scanned, ${result.issuesFound} issues found`,
                            time: timeStr
                        }]);

                        // Update current scan with results
                        setCurrentScan({
                            id: result.scanId,
                            status: 'completed',
                            score: result.score,
                            files_scanned: result.filesScanned,
                            issues_found: result.issuesFound,
                            scan_duration_ms: result.scanDurationMs,
                            results: { issues: result.issues },
                            created_at: new Date().toISOString(),
                        });

                        // Refresh project data
                        fetch(`/api/scan/projects/${projectId}`)
                            .then(res => res.json())
                            .then(projectData => {
                                setProject(projectData.project);
                                setScans(projectData.scans || []);
                            });

                        eventSource.close();
                        setIsScanning(false);
                    } else if (data.type === 'error') {
                        setScanLog(prev => [...prev, { type: "error", message: data.message, time: timeStr }]);
                        eventSource.close();
                        setIsScanning(false);
                    }
                } catch (parseErr) {
                    console.error('Error parsing SSE event:', parseErr);
                }
            };

            eventSource.onerror = () => {
                setScanLog(prev => [...prev, { type: "error", message: "Connection lost" }]);
                eventSource.close();
                setIsScanning(false);
            };

        } catch (err) {
            console.error('Scan error:', err);
            setScanLog(prev => [...prev, { type: "error", message: "Failed to run scan" }]);
            setIsScanning(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-7 w-24" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="text-center py-16">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mx-auto mb-3">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">Project not found</p>
                    <p className="text-xs text-muted-foreground">The project you're looking for doesn't exist.</p>
                </div>
            </div>
        );
    }

    const score = project.last_scan_score || currentScan?.score;

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8">
            {/* Back link */}
            <Link href="/scan" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-3 w-3" />
                Back to projects
            </Link>

            {/* Project header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-base font-medium font-mono">{project.github_repo_full_name}</h1>
                        {score && (
                            <Badge variant="outline" className="gap-1.5 text-[11px] px-2 py-0.5 border-foreground/20 text-foreground">
                                <span className={cn("size-1.5 rounded-full", scoreColors[score] || "bg-gray-500")} />
                                {score}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last scan: {formatTimeAgo(project.last_scan_at)}
                        </span>
                        <span>•</span>
                        <span>{project.last_scan_files || 0} files</span>
                        {project.last_scan_issues > 0 && (
                            <>
                                <span>•</span>
                                <span className="text-yellow-500">{project.last_scan_issues} issues</span>
                            </>
                        )}
                    </div>
                </div>
                <Button
                    onClick={handleRunScan}
                    disabled={isScanning}
                    size="sm"
                    className="h-7 text-xs px-3"
                >
                    {isScanning ? (
                        <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Scanning...</>
                    ) : (
                        "Run Scan"
                    )}
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="scan" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="scan">Scan</TabsTrigger>
                    <TabsTrigger value="changelog">Changelog</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="scan" className="space-y-6">
                    {/* Auto-fix banner */}
                    {(project.last_scan_issues > 0 || (currentScan?.issues_found || 0) > 0) && (
                        <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div>
                                    <p className="text-[13px] font-medium text-emerald-300">Auto-fix available</p>
                                    <p className="text-xs text-muted-foreground">
                                        {currentScan?.issues_found || project.last_scan_issues} issues can be automatically fixed
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" className="h-7 text-xs px-3 bg-emerald-500 hover:bg-emerald-600">
                                Create Fix PR
                            </Button>
                        </div>
                    )}

                    <div className="flex gap-4">
                        {/* Scan history sidebar */}
                        {scans.length > 0 && (
                            <div className="w-48 shrink-0 space-y-1">
                                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                    Scan History
                                </div>
                                {scans.map((scan) => {
                                    const isSelected = currentScan?.id === scan.id;
                                    const date = new Date(scan.created_at);
                                    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    return (
                                        <button
                                            key={scan.id}
                                            onClick={() => {
                                                setCurrentScan(scan);
                                                // Populate scan log from this scan's logs or results
                                                if (scan.logs && scan.logs.length > 0) {
                                                    setScanLog(scan.logs.map(log => ({
                                                        type: log.type,
                                                        message: log.message || '',
                                                        time: `${(log.time / 1000).toFixed(1)}s`,
                                                        severity: (log.data as { severity?: string })?.severity,
                                                        line: (log.data as { line?: number })?.line,
                                                    })));
                                                } else if (scan.results?.issues) {
                                                    // Fallback to results if logs not available
                                                    const logEntries: Array<{ type: string; message: string; time?: string; severity?: string; line?: number }> = [];
                                                    const timeStr = `${(scan.scan_duration_ms / 1000).toFixed(1)}s`;
                                                    const issuesByFile: Record<string, ScanIssue[]> = {};
                                                    for (const issue of scan.results.issues) {
                                                        if (!issuesByFile[issue.file]) issuesByFile[issue.file] = [];
                                                        issuesByFile[issue.file].push(issue);
                                                    }
                                                    for (const [file, issues] of Object.entries(issuesByFile)) {
                                                        logEntries.push({ type: "file", message: file, time: timeStr });
                                                        for (const issue of issues) {
                                                            logEntries.push({ type: "issue", message: `${issue.name}: ${issue.match}`, severity: issue.severity, line: issue.line });
                                                        }
                                                    }
                                                    logEntries.push({ type: "summary", message: `Complete: ${scan.files_scanned} files scanned, ${scan.issues_found} issues found`, time: timeStr });
                                                    setScanLog(logEntries);
                                                }
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-md text-xs transition-colors",
                                                isSelected
                                                    ? "bg-secondary text-foreground"
                                                    : "hover:bg-secondary/50 text-muted-foreground"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={cn("size-1.5 rounded-full", scoreColors[scan.score || ""] || "bg-gray-500")} />
                                                <span className="font-medium">{dateStr}</span>
                                                <span className="text-muted-foreground/50">{timeStr}</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                                {scan.slug || `scan-${scan.id.slice(0, 8)}`}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Scan log */}
                        <div className="flex-1 bg-card border border-border/40 rounded-md overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Scan Log</span>
                                    {currentScan && (
                                        <span className="text-[10px] font-mono text-muted-foreground/60">
                                            {currentScan.slug || `scan-${currentScan.id.slice(0, 8)}`}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {currentScan && (
                                        <>
                                            <span className="text-[11px] text-muted-foreground">
                                                {(currentScan.scan_duration_ms / 1000).toFixed(1)}s
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-[10px]"
                                                    onClick={() => {
                                                        const data = {
                                                            scanId: currentScan.id,
                                                            slug: currentScan.slug,
                                                            score: currentScan.score,
                                                            filesScanned: currentScan.files_scanned,
                                                            issuesFound: currentScan.issues_found,
                                                            durationMs: currentScan.scan_duration_ms,
                                                            createdAt: currentScan.created_at,
                                                            logs: currentScan.logs || [],
                                                            issues: currentScan.results?.issues || [],
                                                        };
                                                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `${currentScan.slug || 'scan'}.json`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    JSON
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-[10px]"
                                                    onClick={() => {
                                                        const lines = [
                                                            `# Scan Report`,
                                                            ``,
                                                            `**ID:** ${currentScan.slug || currentScan.id}`,
                                                            `**Date:** ${new Date(currentScan.created_at).toLocaleString()}`,
                                                            `**Score:** ${currentScan.score}`,
                                                            `**Files Scanned:** ${currentScan.files_scanned}`,
                                                            `**Issues Found:** ${currentScan.issues_found}`,
                                                            `**Duration:** ${(currentScan.scan_duration_ms / 1000).toFixed(1)}s`,
                                                            ``,
                                                        ];
                                                        if (currentScan.results?.issues?.length) {
                                                            lines.push(`## Issues`, ``);
                                                            for (const issue of currentScan.results.issues) {
                                                                lines.push(`- **[${issue.severity.toUpperCase()}]** ${issue.name} in \`${issue.file}\` (line ${issue.line}): ${issue.match}`);
                                                            }
                                                        } else {
                                                            lines.push(`## No Issues Found ✓`);
                                                        }
                                                        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `${currentScan.slug || 'scan'}.md`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    MD
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 font-mono text-xs space-y-1 max-h-[400px] overflow-y-auto">
                                {scanLog.length > 0 ? (
                                    scanLog.map((entry, index) => (
                                        <div key={index} className="flex items-start gap-3 py-0.5">
                                            {entry.type === "info" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <span className="text-muted-foreground">{entry.message}</span>
                                                </>
                                            )}
                                            {entry.type === "start" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <span className="text-blue-400">{entry.message}</span>
                                                </>
                                            )}
                                            {entry.type === "progress" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <span className="text-muted-foreground">{entry.message}</span>
                                                </>
                                            )}
                                            {entry.type === "success" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                                    <span className="text-emerald-500">{entry.message}</span>
                                                </>
                                            )}
                                            {entry.type === "error" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                                                    <span className="text-red-500">{entry.message}</span>
                                                </>
                                            )}
                                            {entry.type === "file" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
                                                    <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                                    <span className="text-yellow-500">{entry.message}</span>
                                                </>
                                            )}
                                            {entry.type === "issue" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0"></span>
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-0.5" />
                                                    <span className={cn("shrink-0", severityColors[entry.severity || "low"])}>
                                                        [{(entry.severity || "low").toUpperCase()}]
                                                    </span>
                                                    <span className="text-muted-foreground">{entry.message}</span>
                                                    <span className="text-muted-foreground/50">line {entry.line}</span>
                                                </>
                                            )}
                                            {entry.type === "summary" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <span className="text-foreground font-medium">✓ {entry.message}</span>
                                                    {currentScan?.score && (
                                                        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
                                                            <span className={cn("size-1 rounded-full", scoreColors[currentScan.score])} />
                                                            {currentScan.score}
                                                        </Badge>
                                                    )}
                                                </>
                                            )}
                                            {entry.type === "complete" && (
                                                <>
                                                    <span className="text-muted-foreground/50 w-10 text-right shrink-0">{entry.time}</span>
                                                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                                    <span className="text-foreground font-medium">{entry.message}</span>
                                                </>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-muted-foreground text-center py-8">
                                        {project.last_scan_at
                                            ? "Click 'Run Scan' to scan again"
                                            : "No scans yet. Click 'Run Scan' to start."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="changelog">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-[13px] font-medium">Changelog</h2>
                            <p className="text-xs text-muted-foreground">Generate changelogs from your commit history</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={changelogTimeframe}
                                onChange={(e) => setChangelogTimeframe(e.target.value as '24h' | '7d' | '30d')}
                                className="h-7 px-2 text-xs rounded border border-border/50 bg-secondary/50 text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                disabled={isGeneratingChangelog}
                            >
                                <option value="24h">Last 24 hours</option>
                                <option value="7d">Last 7 days</option>
                                <option value="30d">Last 30 days</option>
                            </select>
                            <Button
                                size="sm"
                                className="h-7 text-xs px-3"
                                onClick={handleGenerateChangelog}
                                disabled={isGeneratingChangelog}
                            >
                                {isGeneratingChangelog ? (
                                    <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating...</>
                                ) : (
                                    "Generate Changelog"
                                )}
                            </Button>
                        </div>
                    </div>

                    {changelogs.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center justify-center">
                            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                                <GitBranch className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium mb-1">No changelogs generated yet</p>
                            <p className="text-xs text-muted-foreground">Click &quot;Generate Changelog&quot; to create your first one</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Changelog list */}
                            <div className="flex gap-4">
                                {/* Sidebar with changelog list */}
                                <div className="w-48 shrink-0 space-y-1">
                                    {changelogs.map((changelog) => {
                                        const isSelected = selectedChangelog?.id === changelog.id;
                                        const date = new Date(changelog.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        });
                                        return (
                                            <button
                                                key={changelog.id}
                                                onClick={() => setSelectedChangelog(changelog)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-md text-xs transition-colors",
                                                    isSelected
                                                        ? "bg-secondary text-foreground"
                                                        : "hover:bg-secondary/50 text-muted-foreground"
                                                )}
                                            >
                                                <div className="font-medium">{date}</div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {changelog.commit_count} commits
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Changelog content */}
                                <div className="flex-1 bg-card border border-border/40 rounded-md p-4 overflow-auto">
                                    {selectedChangelog ? (
                                        <div className="prose prose-sm prose-invert max-w-none">
                                            <pre className="whitespace-pre-wrap text-xs font-mono text-foreground p-0 m-0 bg-transparent">
                                                {selectedChangelog.markdown}
                                            </pre>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground text-center py-8">
                                            Select a changelog to view
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="settings" className="max-w-xl">
                    <h2 className="text-[13px] font-medium mb-6">Project Settings</h2>

                    <div className="space-y-6">
                        {/* Project Details */}
                        <div className="bg-card border border-border/40 rounded-md p-4">
                            <h3 className="text-xs font-medium mb-4">Project Details</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] text-muted-foreground block mb-1.5">Project Name</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-7 px-2.5 text-xs rounded border border-border/50 bg-secondary/30 flex items-center font-mono">
                                            {project.github_repo_full_name}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 w-7 p-0 shrink-0"
                                            onClick={() => handleCopyToClipboard(project.github_repo_full_name, 'name')}
                                        >
                                            {copiedField === 'name' ? (
                                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground block mb-1.5">Project ID</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-7 px-2.5 text-xs rounded border border-border/50 bg-secondary/30 flex items-center font-mono text-muted-foreground">
                                            {project.id}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 w-7 p-0 shrink-0"
                                            onClick={() => handleCopyToClipboard(project.id, 'id')}
                                        >
                                            {copiedField === 'id' ? (
                                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground block mb-1.5">GitHub URL</label>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={project.github_repo_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 h-7 px-2.5 text-xs rounded border border-border/50 bg-secondary/30 flex items-center font-mono text-blue-400 hover:text-blue-300 hover:underline truncate"
                                        >
                                            {project.github_repo_url}
                                        </a>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 w-7 p-0 shrink-0"
                                            onClick={() => handleCopyToClipboard(project.github_repo_url, 'url')}
                                        >
                                            {copiedField === 'url' ? (
                                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="bg-card border border-border/40 rounded-md p-4">
                            <h3 className="text-xs font-medium mb-4">Notifications</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] text-muted-foreground block mb-1.5">Slack Webhook URL</label>
                                    <input
                                        type="text"
                                        defaultValue={project.slack_webhook_url || ""}
                                        placeholder="https://hooks.slack.com/services/..."
                                        className="w-full h-7 px-2.5 text-xs rounded border border-border/50 bg-transparent placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground block mb-1.5">Discord Webhook URL</label>
                                    <input
                                        type="text"
                                        defaultValue={project.discord_webhook_url || ""}
                                        placeholder="https://discord.com/api/webhooks/..."
                                        className="w-full h-7 px-2.5 text-xs rounded border border-border/50 bg-transparent placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button size="sm" className="h-7 text-xs px-3">
                            Save Settings
                        </Button>

                        {/* Danger Zone */}
                        <div className="bg-red-500/5 border border-red-500/20 rounded-md p-4 mt-8">
                            <h3 className="text-xs font-medium text-red-400 mb-2">Danger Zone</h3>
                            <p className="text-[11px] text-muted-foreground mb-4">
                                Deleting this project will permanently remove all scan history and changelogs. This action cannot be undone.
                            </p>

                            {!showDeleteConfirm ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-3 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <Trash2 className="h-3 w-3 mr-1.5" />
                                    Delete Project
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs px-3 bg-red-500 hover:bg-red-600 text-white"
                                        onClick={handleDeleteProject}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? (
                                            <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Deleting...</>
                                        ) : (
                                            <>Confirm Delete</>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs px-3"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={isDeleting}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
