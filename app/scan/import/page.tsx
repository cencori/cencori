"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    GitBranch,
    Search,
    Loader2,
    ArrowLeft,
    ExternalLink,
    Check
} from "lucide-react";

// GitHub Octocat icon
const GitHubIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 128 128" className={className} fill="currentColor">
        <g><path fillRule="evenodd" clipRule="evenodd" d="M64 5.103c-33.347 0-60.388 27.035-60.388 60.388 0 26.682 17.303 49.317 41.297 57.303 3.017.56 4.125-1.31 4.125-2.905 0-1.44-.056-6.197-.082-11.243-16.8 3.653-20.345-7.125-20.345-7.125-2.747-6.98-6.705-8.836-6.705-8.836-5.48-3.748.413-3.67.413-3.67 6.063.425 9.257 6.223 9.257 6.223 5.386 9.23 14.127 6.562 17.573 5.02.542-3.903 2.107-6.568 3.834-8.076-13.413-1.525-27.514-6.704-27.514-29.843 0-6.593 2.36-11.98 6.223-16.21-.628-1.52-2.695-7.662.584-15.98 0 0 5.07-1.623 16.61 6.19C53.7 35 58.867 34.327 64 34.304c5.13.023 10.3.694 15.127 2.033 11.526-7.813 16.59-6.19 16.59-6.19 3.287 8.317 1.22 14.46.593 15.98 3.872 4.23 6.215 9.617 6.215 16.21 0 23.194-14.127 28.3-27.574 29.796 2.167 1.874 4.097 5.55 4.097 11.183 0 8.08-.07 14.583-.07 16.572 0 1.607 1.088 3.49 4.148 2.897 23.98-7.994 41.263-30.622 41.263-57.294C124.388 32.14 97.35 5.104 64 5.104z"></path><path d="M26.484 91.806c-.133.3-.605.39-1.035.185-.44-.196-.685-.605-.543-.906.13-.31.603-.395 1.04-.188.44.197.69.61.537.91zm2.446 2.729c-.287.267-.85.143-1.232-.28-.396-.42-.47-.983-.177-1.254.298-.266.844-.14 1.24.28.394.426.472.984.17 1.255zM31.312 98.012c-.37.258-.976.017-1.35-.52-.37-.538-.37-1.183.01-1.44.373-.258.97-.025 1.35.507.368.545.368 1.19-.01 1.452zm3.261 3.361c-.33.365-1.036.267-1.552-.23-.527-.487-.674-1.18-.343-1.544.336-.366 1.045-.264 1.564.23.527.486.686 1.18.333 1.543zm4.5 1.951c-.147.473-.825.688-1.51.486-.683-.207-1.13-.76-.99-1.238.14-.477.823-.7 1.512-.485.683.206 1.13.756.988 1.237zm4.943.361c.017.498-.563.91-1.28.92-.723.017-1.308-.387-1.315-.877 0-.503.568-.91 1.29-.924.717-.013 1.306.387 1.306.88zm4.598-.782c.086.485-.413.984-1.126 1.117-.7.13-1.35-.172-1.44-.653-.086-.498.422-.997 1.122-1.126.714-.123 1.354.17 1.444.663zm0 0"></path></g>
    </svg>
);
import Link from "next/link";

interface GitHubRepo {
    id: number;
    full_name: string;
    html_url: string;
    description: string | null;
    installation_id: number;
    already_imported?: boolean;
}

const GITHUB_APP_SLUG = "cencori";

export default function ImportRepoPage() {
    const router = useRouter();
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [importingRepoId, setImportingRepoId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch repos from GitHub installations
    useEffect(() => {
        const fetchRepos = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/scan/github/repos');

                if (response.status === 401) {
                    setIsConnected(false);
                    setError('Unauthorized');
                    setIsLoading(false);
                    return;
                }

                const data = await response.json();

                if (data.repositories && data.repositories.length > 0) {
                    setIsConnected(true);
                    setRepos(data.repositories);
                } else {
                    setIsConnected(false);
                    if (data.message) {
                        setError(data.message);
                    }
                }
            } catch (err) {
                console.error('Error fetching repos:', err);
                setError('Failed to fetch repositories');
                setIsConnected(false);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRepos();
    }, []);

    const handleConnectGitHub = () => {
        const state = JSON.stringify({
            redirect: "/scan/import",
            source: "scan"
        });
        const url = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;
        window.location.href = url;
    };

    const handleImport = async (repo: GitHubRepo) => {
        if (repo.already_imported) return;

        setImportingRepoId(repo.id);
        try {
            const response = await fetch('/api/scan/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    github_repo_id: repo.id,
                    github_repo_full_name: repo.full_name,
                    github_repo_url: repo.html_url,
                    github_repo_description: repo.description,
                    github_installation_id: repo.installation_id,
                })
            });

            const data = await response.json();

            if (response.ok) {
                router.push(`/projects/${data.project.id}`);
            } else {
                console.error('Import failed:', data.error);
                setImportingRepoId(null);
            }
        } catch (err) {
            console.error('Import error:', err);
            setImportingRepoId(null);
        }
    };

    const filteredRepos = searchTerm
        ? repos.filter(repo =>
            repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : repos;

    if (isLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="mb-8">
                    <Skeleton className="h-5 w-40 mb-2" />
                    <Skeleton className="h-3 w-64" />
                </div>
                <div className="bg-card border border-border/40 rounded-md">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="border-b border-border/40 px-4 py-3 last:border-b-0">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Skeleton className="h-3.5 w-32" />
                                    <Skeleton className="h-2.5 w-48" />
                                </div>
                                <Skeleton className="h-7 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!isConnected) {
        // Check for success/error query params
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const success = urlParams?.get('success');
        const errorParam = urlParams?.get('error');

        // If success, trigger a refetch
        if (success === 'github_connected' && !isLoading) {
            window.location.href = '/scan/import';
            return null;
        }

        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
                    <ArrowLeft className="h-3 w-3" />
                    Back to projects
                </Link>

                <div className="max-w-md mx-auto text-center py-16">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mx-auto mb-3">
                        <GitHubIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h1 className="text-sm font-medium mb-1">
                        {error?.includes('Unauthorized') ? 'Sign in to continue' : 'Connect GitHub'}
                    </h1>
                    <p className="text-xs text-muted-foreground mb-4">
                        {error?.includes('Unauthorized')
                            ? "Sign in to your Cencori account to import repositories."
                            : errorParam
                                ? `Error: ${errorParam.replace(/_/g, ' ')}`
                                : error || "Install the Cencori GitHub App to import repositories."
                        }
                    </p>
                    {error?.includes('Unauthorized') ? (
                        <Button asChild size="sm" className="h-7 text-xs px-3">
                            <a href={typeof window !== 'undefined' && window.location.hostname.includes('scan.')
                                ? 'https://cencori.com/login?redirect=https://scan.cencori.com/import'
                                : '/login?redirect=/scan/import'}>
                                Sign In
                            </a>
                        </Button>
                    ) : (
                        <Button onClick={handleConnectGitHub} size="sm" className="h-7 text-xs px-3">
                            Install GitHub App
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-3 w-3" />
                Back to projects
            </Link>

            <div className="mb-8">
                <h1 className="text-base font-medium mb-1">Import Repository</h1>
                <p className="text-xs text-muted-foreground">Select a repository to import.</p>
            </div>

            {/* Search and Actions */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        placeholder="Search repositories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoComplete="off"
                        className="w-48 sm:w-64 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60"
                    />
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs px-3" asChild>
                    <a href={`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1.5" />
                        Manage GitHub App
                    </a>
                </Button>
            </div>

            {/* Repos Table */}
            {filteredRepos.length > 0 ? (
                <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/40">
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-4">Repository</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-4">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRepos.map((repo) => (
                                <TableRow
                                    key={repo.id}
                                    className="border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors"
                                >
                                    <TableCell className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <span className="text-[13px] font-mono font-medium">{repo.full_name}</span>
                                            {repo.already_imported && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-500">
                                                    Imported
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 ml-5 truncate max-w-md">
                                            {repo.description || "No description"}
                                        </p>
                                    </TableCell>
                                    <TableCell className="py-3 pr-4 text-right">
                                        <Button
                                            size="sm"
                                            variant={repo.already_imported ? "outline" : "default"}
                                            onClick={() => handleImport(repo)}
                                            disabled={importingRepoId !== null || repo.already_imported}
                                            className="h-7 text-xs px-3"
                                        >
                                            {repo.already_imported ? (
                                                <><Check className="h-3 w-3 mr-1" /> Imported</>
                                            ) : importingRepoId === repo.id ? (
                                                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Importing...</>
                                            ) : (
                                                "Import"
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center py-16 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <GitBranch className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No repositories found</p>
                    <p className="text-xs text-muted-foreground">
                        {searchTerm ? `No repositories matching "${searchTerm}"` : "Install the GitHub App on more repositories"}
                    </p>
                </div>
            )}
        </div>
    );
}
