"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Copy, MoreVertical, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { maskApiKey } from "@/lib/api-keys";

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
}

interface KeyListItemProps {
    apiKey: ApiKey;
    projectId: string;
    onRevoked: () => void;
}

export function KeyListItem({ apiKey, projectId, onRevoked }: KeyListItemProps) {
    const [copied, setCopied] = useState(false);
    const [showRevokeDialog, setShowRevokeDialog] = useState(false);
    const [revoking, setRevoking] = useState(false);

    const maskedKey = maskApiKey(apiKey.key_prefix);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(maskedKey);
        setCopied(true);
        toast.success("Key prefix copied");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevoke = async () => {
        setRevoking(true);
        try {
            const response = await fetch(
                `/api/projects/${projectId}/api-keys/${apiKey.id}`,
                { method: "PATCH" }
            );

            if (!response.ok) {
                throw new Error("Failed to revoke API key");
            }

            toast.success("API key revoked successfully");
            onRevoked();
        } catch (error) {
            console.error("Error revoking API key:", error);
            toast.error("Failed to revoke API key");
        } finally {
            setRevoking(false);
            setShowRevokeDialog(false);
        }
    };

    return (
        <>
            <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* Key info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{apiKey.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                    Active
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="text-sm text-muted-foreground font-mono">
                                    {maskedKey}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={handleCopy}
                                >
                                    {copied ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                                Created {new Date(apiKey.created_at).toLocaleDateString()}
                                {apiKey.last_used_at && (
                                    <span className="ml-3">
                                        Last used {new Date(apiKey.last_used_at).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    className="text-red-600 cursor-pointer"
                                    onClick={() => setShowRevokeDialog(true)}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Revoke Key
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            {/* Revoke confirmation dialog */}
            <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to revoke &lsquo;{apiKey.name}&rsquo;? This action cannot be undone and any
                            applications using this key will stop working immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRevoke}
                            disabled={revoking}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {revoking ? "Revoking..." : "Revoke Key"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
