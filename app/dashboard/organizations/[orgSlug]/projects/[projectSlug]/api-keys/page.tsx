"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateKeyDialog } from "@/components/api-keys/GenerateKeyDialog";
import { KeyListItem } from "@/components/api-keys/KeyListItem";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";

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
    params: { orgSlug: string; projectSlug: string } | Promise<{ orgSlug: string; projectSlug: string }>;
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

                // Fetch project details
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

                // Fetch API keys
                await fetchApiKeys(projectData.id);
            } catch (err) {
                console.error("Unexpected error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectAndKeys();
    }, [orgSlug, projectSlug, router, environment]); // Re-fetch when environment changes

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

    if (loading) {
        return (
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Header Skeleton */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-full max-w-md" />
                    </div>
                    <Skeleton className="h-10 w-full sm:w-40" />
                </div>

                {/* API Keys List Skeleton */}
                <div className="border-2 border-border relative before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-4 before:border-l-4 before:border-primary after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-4 after:border-r-4 after:border-primary">
                    <div className="bg-card">
                        <div className="p-6 border-b">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-full max-w-md mt-2" />
                        </div>
                        <div className="overflow-x-auto">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px] sm:w-[200px]"></TableHead>
                                        <TableHead className="min-w-[250px] sm:min-w-[300px]"></TableHead>
                                        <TableHead className="w-[80px] sm:w-[100px]"></TableHead>
                                        <TableHead className="hidden lg:table-cell w-[120px]"></TableHead>
                                        <TableHead className="hidden lg:table-cell w-[120px]"></TableHead>
                                        <TableHead className="w-[60px] sm:w-[80px] text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[1, 2, 3].map((i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-24 sm:w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-48 sm:w-64" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-14 sm:w-16" /></TableCell>
                                            <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        API Keys
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        Manage API keys for authenticating requests to your project
                    </p>
                </div>
                <Button onClick={() => setShowGenerateDialog(true)} className="w-full sm:w-auto">
                    <Plus size={16} className="mr-2" />
                    Generate New Key
                </Button>
            </div>

            {/* API Keys List */}
            {apiKeys.length > 0 ? (
                <div className="overflow-x-auto border-2 border-border relative before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-4 before:border-l-4 before:border-primary after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-4 after:border-r-4 after:border-primary">
                    <div className="bg-card">
                        <div className="overflow-x-auto">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px] sm:w-[200px]">Name</TableHead>
                                        <TableHead className="min-w-[250px] sm:min-w-[300px]">API Key</TableHead>
                                        <TableHead className="w-[80px] sm:w-[100px]">Status</TableHead>
                                        <TableHead className="hidden lg:table-cell w-[120px]">Created</TableHead>
                                        <TableHead className="hidden lg:table-cell w-[120px]">Last Used</TableHead>
                                        <TableHead className="w-[60px] sm:w-[80px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {apiKeys.map((key) => (
                                        <KeyListItem
                                            key={key.id}
                                            apiKey={key}
                                            projectId={projectId!}
                                            onRevoked={handleKeyGenerated}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            ) : (
                <Card>
                    <CardContent className="text-center py-12">
                        <div className="mx-auto w-fit rounded-full bg-muted p-6 mb-4">
                            <Key className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <CardTitle>No API Keys Yet</CardTitle>
                        <CardDescription className="max-w-md mx-auto">
                            Generate your first API key to start authenticating requests to your project. You can
                            create multiple keys for different environments or use cases.
                        </CardDescription>
                    </CardContent>
                    <CardContent className="text-center pb-12">
                        <Button onClick={() => setShowGenerateDialog(true)}>
                            <Plus size={16} className="mr-2" />
                            Generate Your First Key
                        </Button>
                    </CardContent>
                </Card>
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
        </div>
    );
}
