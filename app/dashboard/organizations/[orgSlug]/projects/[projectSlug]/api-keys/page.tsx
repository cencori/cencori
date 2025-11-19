"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateKeyDialog } from "@/components/api-keys/GenerateKeyDialog";
import { KeyListItem } from "@/components/api-keys/KeyListItem";

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
    }, [orgSlug, projectSlug, router]);

    const fetchApiKeys = async (projId: string) => {
        try {
            const response = await fetch(`/api/projects/${projId}/api-keys`);
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
            <div className="mx-92 py-24 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-92 py-24 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Key size={28} />
                        API Keys
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage API keys for authenticating requests to your project
                    </p>
                </div>
                <Button onClick={() => setShowGenerateDialog(true)}>
                    <Plus size={16} className="mr-2" />
                    Generate New Key
                </Button>
            </div>

            {/* API Keys List */}
            {apiKeys.length > 0 ? (
                <div className="space-y-3">
                    {apiKeys.map((key) => (
                        <KeyListItem
                            key={key.id}
                            apiKey={key}
                            projectId={projectId!}
                            onRevoked={handleKeyGenerated}
                        />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardHeader className="text-center py-12">
                        <div className="mx-auto w-fit rounded-full bg-muted p-6 mb-4">
                            <Key className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <CardTitle>No API Keys Yet</CardTitle>
                        <CardDescription className="max-w-md mx-auto">
                            Generate your first API key to start authenticating requests to your project. You can
                            create multiple keys for different environments or use cases.
                        </CardDescription>
                    </CardHeader>
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
