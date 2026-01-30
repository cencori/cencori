"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
    ArrowLeft
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
    created_at: string;
    status: string;
    score: string | null;
    files_scanned: number;
    issues_found: number;
    scan_duration_ms: number;
    results?: { issues: ScanIssue[] };
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
    const projectId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [project, setProject] = useState<ScanProject | null>(null);
    const [scans, setScans] = useState<ScanRun[]>([]);
    const [currentScan, setCurrentScan] = useState<ScanRun | null>(null);
    const [scanLog, setScanLog] = useState<Array<{ type: string; message: string; time?: string; severity?: string; line?: number }>>([]);

    // Fetch project data
    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await fetch(`/api/scan/projects/${projectId}`);
                if (response.ok) {
                    const data = await response.json();
                    setProject(data.project);
                    setScans(data.scans || []);
                    if (data.scans && data.scans.length > 0) {
                        setCurrentScan(data.scans[0]);
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

                    {/* Scan log */}
                    <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Scan Log</span>
                            {currentScan && (
                                <span className="text-[11px] text-muted-foreground">
                                    {(currentScan.scan_duration_ms / 1000).toFixed(1)}s
                                </span>
                            )}
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
                </TabsContent>

                <TabsContent value="changelog">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-[13px] font-medium">Changelog</h2>
                            <p className="text-xs text-muted-foreground">Generate changelogs from your commit history</p>
                        </div>
                        <Button size="sm" className="h-7 text-xs px-3">
                            Generate Changelog
                        </Button>
                    </div>
                    <div className="text-center py-16 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                            <GitBranch className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium mb-1">No changelogs generated yet</p>
                        <p className="text-xs text-muted-foreground">Click "Generate Changelog" to create your first one</p>
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="max-w-xl">
                    <h2 className="text-[13px] font-medium mb-6">Project Settings</h2>

                    <div className="space-y-6">
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
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
