"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Copy, Check, MoreVertical, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateKeyDialog } from "@/components/api-keys/GenerateKeyDialog";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { maskApiKey } from "@/lib/api-keys";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
}

export default function ApiKeysPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const [orgSlug, setOrgSlug] = useState<string | null>(null);
    const [projectSlug, setProjectSlug] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const resolved = await Promise.resolve(params);
                if (mounted && resolved) {
                    if (typeof resolved.orgSlug === "string") setOrgSlug(resolved.orgSlug);
                    if (typeof resolved.projectSlug === "string") setProjectSlug(resolved.projectSlug);
                }
            } catch (e) {
                console.error("Failed to resolve params:", e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [params]);

    const router = useRouter();
    const { environment } = useEnvironment();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGenerateDialog, setShowGenerateDialog] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showRevokeDialog, setShowRevokeDialog] = useState(false);
    const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
    const [revoking, setRevoking] = useState(false);

    useEffect(() => {
        if (!orgSlug || !projectSlug) return;

        const fetchProjectAndKeys = async () => {
            setLoading(true);
            try {
                const { data: { user }, error: userError } = await browserSupabase.auth.getUser();
                if (userError || !user) {
                    router.push("/login");
                    return;
                }

                const { data: orgData, error: orgError } = await browserSupabase
                    .from("organizations")
                    .select("id")
                    .eq("slug", orgSlug)
                    .eq("owner_id", user.id)
                    .single();

                if (orgError || !orgData) {
                    router.push("/dashboard/organizations");
                    return;
                }

                const { data: projectData, error: projectError } = await browserSupabase
                    .from("projects")
                    .select("id")
                    .eq("organization_id", orgData.id)
                    .eq("slug", projectSlug)
                    .single();

                if (projectError || !projectData) {
                    router.push(`/dashboard/organizations/${orgSlug}/projects`);
                    return;
                }

                setProjectId(projectData.id);
                await fetchApiKeys(projectData.id);
            } catch (err) {
                console.error("Unexpected error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectAndKeys();
    }, [orgSlug, projectSlug, router, environment]);

    const fetchApiKeys = async (projId: string) => {
        try {
            const response = await fetch(`/api/projects/${projId}/api-keys?environment=${environment}`);
            if (response.ok) {
                const data = await response.json();
                setApiKeys(data.apiKeys || []);
            }
        } catch (error) {
            console.error("Error fetching API keys:", error);
        }
    };

    const handleKeyGenerated = () => {
        if (projectId) {
            fetchApiKeys(projectId);
        }
    };

    const handleCopy = async (key: ApiKey) => {
        const maskedKey = maskApiKey(key.key_prefix);
        await navigator.clipboard.writeText(maskedKey);
        setCopiedId(key.id);
        toast.success("Key prefix copied");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleRevoke = async () => {
        if (!keyToRevoke || !projectId) return;
        setRevoking(true);
        try {
            const response = await fetch(
                `/api/projects/${projectId}/api-keys/${keyToRevoke.id}`,
                { method: "PATCH" }
            );

            if (!response.ok) {
                throw new Error("Failed to revoke API key");
            }

            toast.success("API key revoked successfully");
            handleKeyGenerated();
        } catch (error) {
            console.error("Error revoking API key:", error);
            toast.error("Failed to revoke API key");
        } finally {
            setRevoking(false);
            setShowRevokeDialog(false);
            setKeyToRevoke(null);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleString("en-US", { month: "short" });
        return `${month} ${day}, ${date.getFullYear()}`;
    };

    if (loading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex items-center justify-end mb-6">
                    <Skeleton className="h-7 w-32" />
                </div>
                <div className="bg-card border border-border/40 rounded-md">
                    <div className="border-b border-border/40 px-4 py-2">
                        <div className="grid grid-cols-5 gap-4">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-10" />
                            <Skeleton className="h-3 w-14" />
                            <Skeleton className="h-3 w-8 ml-auto" />
                        </div>
                    </div>
                    {[1, 2].map((i) => (
                        <div key={i} className="border-b border-border/40 px-4 py-3 last:border-b-0">
                            <div className="grid grid-cols-5 gap-4 items-center">
                                <Skeleton className="h-3.5 w-20" />
                                <Skeleton className="h-3 w-40" />
                                <Skeleton className="h-5 w-12" />
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-5 w-5 ml-auto" />
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
                <h1 className="text-base font-medium">API Keys</h1>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end mb-6">
                <Button size="sm" className="h-7 text-xs px-3" onClick={() => setShowGenerateDialog(true)}>
                    <Plus size={12} className="mr-1.5" />
                    Generate key
                </Button>
            </div>

            {/* API Keys Table */}
            {apiKeys.length > 0 ? (
                <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/40">
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-4">Name</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">API Key</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Status</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Created</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Last Used</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-4">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {apiKeys.map((apiKey) => (
                                <TableRow
                                    key={apiKey.id}
                                    className="hover:bg-secondary/30 border-b border-border/40 last:border-b-0 transition-colors"
                                >
                                    <TableCell className="py-3 px-4">
                                        <span className="text-[13px] font-medium">{apiKey.name}</span>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-1.5">
                                            <code className="text-[11px] text-muted-foreground font-mono">
                                                {maskApiKey(apiKey.key_prefix)}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5"
                                                onClick={() => handleCopy(apiKey)}
                                            >
                                                {copiedId === apiKey.id ? (
                                                    <Check className="h-2.5 w-2.5 text-emerald-500" />
                                                ) : (
                                                    <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge variant="outline" className="gap-1.5 text-[11px] px-2 py-0.5 border-foreground/20 text-foreground">
                                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
                                            Active
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-3 text-xs text-muted-foreground">
                                        {formatDate(apiKey.created_at)}
                                    </TableCell>
                                    <TableCell className="py-3 text-xs text-muted-foreground">
                                        {apiKey.last_used_at ? formatDate(apiKey.last_used_at) : "Never"}
                                    </TableCell>
                                    <TableCell className="py-3 pr-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem
                                                    className="text-xs text-red-600 cursor-pointer"
                                                    onClick={() => {
                                                        setKeyToRevoke(apiKey);
                                                        setShowRevokeDialog(true);
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3 mr-2" />
                                                    Revoke key
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center py-16 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No API keys</p>
                    <p className="text-xs text-muted-foreground mb-4">
                        Generate your first API key to authenticate requests
                    </p>
                    <Button size="sm" className="h-7 text-xs px-3" onClick={() => setShowGenerateDialog(true)}>
                        <Plus size={12} className="mr-1.5" />
                        Generate key
                    </Button>
                </div>
            )}

            {/* Generate Key Dialog */}
            {projectId && (
                <GenerateKeyDialog
                    projectId={projectId}
                    open={showGenerateDialog}
                    onOpenChange={setShowGenerateDialog}
                    onKeyGenerated={handleKeyGenerated}
                />
            )}

            {/* Revoke confirmation dialog */}
            <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">Revoke API Key</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                            Are you sure you want to revoke &lsquo;{keyToRevoke?.name}&rsquo;? This action cannot be undone and any
                            applications using this key will stop working immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="h-7 text-xs">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRevoke}
                            disabled={revoking}
                            className="h-7 text-xs bg-red-600 hover:bg-red-700"
                        >
                            {revoking ? "Revoking..." : "Revoke"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
