"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusIcon, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Heroicons archive-box-arrow-down icon
const ArchiveBoxArrowDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
);

interface ScanProject {
    id: string;
    github_repo_full_name: string;
    last_scan_at: string | null;
    last_scan_score: string | null;
    last_scan_issues: number;
    last_scan_files: number;
    created_at: string;
}

const scoreColors: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-blue-500",
    C: "bg-yellow-500",
    D: "bg-orange-500",
    F: "bg-red-500",
};

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "short" });
    return `${month} ${day}, ${date.getFullYear()}`;
}

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

export default function ScanDashboardPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<ScanProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await fetch('/api/scan/projects');
                if (response.ok) {
                    const data = await response.json();
                    setProjects(data.projects || []);
                }
            } catch (err) {
                console.error('Error fetching projects:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const filteredProjects = projects.filter(project =>
        project.github_repo_full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <Skeleton className="h-5 w-24" />
                </div>
                <div className="flex items-center justify-between gap-4 mb-6">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-7 w-28" />
                </div>
                <div className="bg-card border border-border/40 rounded-md">
                    <div className="border-b border-border/40 px-4 py-2">
                        <div className="grid grid-cols-4 gap-4">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-10" />
                            <Skeleton className="h-3 w-6 ml-auto" />
                        </div>
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="border-b border-border/40 px-4 py-3 last:border-b-0">
                            <div className="grid grid-cols-4 gap-4 items-center">
                                <div className="space-y-1">
                                    <Skeleton className="h-3.5 w-32" />
                                    <Skeleton className="h-2.5 w-24" />
                                </div>
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-5 w-8 ml-auto" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-base font-medium">Projects</h1>
            </div>

            {/* Search and Actions */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search for a project..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoComplete="off"
                        className="w-48 sm:w-64 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60"
                    />
                </div>
                <Button asChild size="sm" className="h-7 text-xs px-3">
                    <Link href="/scan/import">
                        <PlusIcon size={14} className="mr-1" />
                        Import repository
                    </Link>
                </Button>
            </div>

            {/* Projects Table */}
            {filteredProjects.length > 0 ? (
                <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/40">
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-4">Repository</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Last Scan</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Issues</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-4">Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProjects.map((project) => (
                                <TableRow
                                    key={project.id}
                                    className="cursor-pointer hover:bg-secondary/30 border-b border-border/40 last:border-b-0 transition-colors"
                                    onClick={() => router.push(`/scan/projects/${project.id}`)}
                                >
                                    <TableCell className="py-3 px-4">
                                        <div className="text-[13px] font-medium font-mono">{project.github_repo_full_name}</div>
                                        <div className="text-[11px] text-muted-foreground">{project.last_scan_files || 0} files scanned</div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground py-3">
                                        {formatTimeAgo(project.last_scan_at)}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        {project.last_scan_issues > 0 ? (
                                            <span className="text-xs text-yellow-500">{project.last_scan_issues} issues</span>
                                        ) : project.last_scan_score ? (
                                            <span className="text-xs text-emerald-500">No issues</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-3 pr-4 text-right">
                                        {project.last_scan_score ? (
                                            <Badge variant="outline" className="gap-1.5 text-[11px] px-2 py-0.5 border-foreground/20 text-foreground">
                                                <span
                                                    className={`size-1.5 rounded-full ${scoreColors[project.last_scan_score] || "bg-gray-500"}`}
                                                    aria-hidden="true"
                                                ></span>
                                                {project.last_scan_score}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center py-16 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <ArchiveBoxArrowDownIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No projects found</p>
                    <p className="text-xs text-muted-foreground mb-4">
                        {searchTerm ? `No projects matching "${searchTerm}"` : "Import a GitHub repository to start scanning"}
                    </p>
                    {!searchTerm && (
                        <Button asChild size="sm" className="h-7 text-xs px-3">
                            <Link href="/scan/import">Import repository</Link>
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
