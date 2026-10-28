"use client";

/**
 * Provider Key Manager Component
 * 
 * Allows users to manage their API keys for supported AI providers (BYOK).
 * Part of project settings.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { Check, ChevronRight, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SUPPORTED_PROVIDERS, type AIProviderConfig } from "@/lib/providers/config";
import { getProviderLogoMark } from "@/components/dashboard/ProviderLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const PROVIDERS_PER_PAGE = 10;

function getProviderLogo(providerId: string, size: 'sm' | 'md' = 'md') {
    const logo = getProviderLogoMark(providerId) ?? (
        <span className="text-xs font-semibold uppercase text-muted-foreground">
            {providerId.slice(0, 1)}
        </span>
    );
    const baseClass = size === 'sm'
        ? "w-5 h-5 flex items-center justify-center rounded-md bg-muted/50"
        : "w-8 h-8 flex items-center justify-center rounded-lg bg-muted/50";
    return <div className={baseClass}>{logo}</div>;
}

interface ProviderKeyData {
    provider: string;
    providerName: string;
    hasKey: boolean;
    keyHint?: string;
    apiKey?: string;
    isActive: boolean;
    createdAt?: string;
    source?: 'dashboard' | 'api';
    connectionId?: string;
}

interface ProviderKeysResponse {
    providers: ProviderKeyData[];
    defaults: {
        provider: string;
        model: string;
        imageModel?: string;
    };
}

interface ProviderKeyManagerProps {
    projectId?: string;
}

export function ProviderKeyManager({ projectId }: ProviderKeyManagerProps) {
    const queryClient = useQueryClient();
    const [selectedProvider, setSelectedProvider] = useState<AIProviderConfig | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [setAsDefault, setSetAsDefault] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [existingKeyHint, setExistingKeyHint] = useState<string | null>(null);
    const [isProviderActive, setIsProviderActive] = useState(true);
    const [page, setPage] = useState(1);

    // Fetch provider keys
    const { data, isLoading } = useQuery<ProviderKeysResponse>({
        queryKey: ["provider-keys", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/provider-keys`);
            if (!res.ok) throw new Error("Failed to fetch provider keys");
            return res.json();
        },
        enabled: !!projectId,
    });

    // Add/update key mutation
    const addKeyMutation = useMutation({
        mutationFn: async (payload: { provider: string; apiKey: string; setAsDefault?: boolean }) => {
            const res = await fetch(`/api/projects/${projectId}/provider-keys`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                // Surface the server's actual reason — a generic message hides
                // whether it's auth, permissions, validation, or a server bug.
                const body = await res.json().catch(() => null) as { error?: unknown; message?: string } | null;
                const serverError =
                    typeof body?.error === 'string' ? body.error
                    : body?.message
                    || (typeof body?.error === 'object' && body?.error && 'message' in body.error
                        ? String((body.error as { message?: unknown }).message)
                        : `HTTP ${res.status}`);
                throw new Error(serverError);
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["provider-keys", projectId] });
            toast.success("Provider key saved");
            resetDialog();
        },
        onError: (error) =>
            toast.error(`Failed to save provider key: ${error instanceof Error ? error.message : 'unknown error'}`),
    });

    // Delete key mutation
    const deleteKeyMutation = useMutation({
        mutationFn: async (provider: string) => {
            const res = await fetch(`/api/projects/${projectId}/provider-keys/${provider}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete key");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["provider-keys", projectId] });
            toast.success("Provider key removed");
        },
        onError: () => toast.error("Failed to remove provider key"),
    });

    // Toggle active mutation
    const toggleMutation = useMutation({
        mutationFn: async ({ provider, isActive }: { provider: string; isActive: boolean }) => {
            const res = await fetch(`/api/projects/${projectId}/provider-keys/${provider}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive }),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["provider-keys", projectId] });
            toast.success(variables.isActive ? "Provider enabled" : "Provider disabled");
        },
    });

    // Update existing key mutation
    const updateKeyMutation = useMutation({
        mutationFn: async (payload: { provider: string; apiKey?: string; setAsDefault?: boolean }) => {
            const res = await fetch(`/api/projects/${projectId}/provider-keys/${payload.provider}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKey: payload.apiKey || undefined,
                    setAsDefault: payload.setAsDefault,
                }),
            });
            if (!res.ok) throw new Error("Failed to update key settings");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["provider-keys", projectId] });
            toast.success("Provider settings updated");
            resetDialog();
        },
        onError: () => toast.error("Failed to update provider settings"),
    });

    const resetDialog = () => {
        setDialogOpen(false);
        setSelectedProvider(null);
        setApiKey("");
        setShowKey(false);
        setSetAsDefault(false);
        setExistingKeyHint(null);
    };

    const handleAddKey = () => {
        if (!selectedProvider) return;

        const existingKey = data?.providers.find(p => p.provider === selectedProvider.id);

        if (existingKeyHint) {
            updateKeyMutation.mutate({
                provider: selectedProvider.id,
                // Only send apiKey if the user typed something new and it's different from the already saved one
                apiKey: apiKey && apiKey !== existingKey?.apiKey ? apiKey : undefined,
                setAsDefault: setAsDefault,
            });
        } else {
            if (!apiKey) return;
            addKeyMutation.mutate({
                provider: selectedProvider.id,
                apiKey,
                setAsDefault: setAsDefault,
            });
        }
    };

    const openAddDialog = (provider: AIProviderConfig) => {
        setSelectedProvider(provider);

        // Check if provider already has a key
        const existingKey = data?.providers.find(p => p.provider === provider.id);

        // Initialize Set as Default tracking based on global defaults
        setSetAsDefault(data?.defaults?.provider === provider.id);

        if (existingKey?.hasKey) {
            setExistingKeyHint(existingKey.keyHint || '***');
            if (existingKey.apiKey) {
                setApiKey(existingKey.apiKey);
            }
            setIsProviderActive(existingKey.isActive);
        } else {
            setExistingKeyHint(null);
            setIsProviderActive(true);
        }

        setDialogOpen(true);
    };

    if (!projectId || isLoading) {
        return (
            <div className="space-y-1">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-3 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-8 h-8 rounded-lg" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-md" />
                    </div>
                ))}
            </div>
        );
    }

    const configuredProviders = data?.providers.filter(p => p.hasKey) || [];
    const availableProviders = SUPPORTED_PROVIDERS.filter(p => !data?.providers.find(dp => dp.provider === p.id && dp.hasKey));

    const totalPages = Math.max(1, Math.ceil(SUPPORTED_PROVIDERS.length / PROVIDERS_PER_PAGE));
    const currentPage = Math.min(page, totalPages);
    const pageProviders = SUPPORTED_PROVIDERS.slice(
        (currentPage - 1) * PROVIDERS_PER_PAGE,
        currentPage * PROVIDERS_PER_PAGE,
    );

    return (
        <div className="space-y-1">
            {/* All Providers as a List */}
            {pageProviders.map((provider) => {
                const keyData = data?.providers.find(p => p.provider === provider.id);
                const hasKey = keyData?.hasKey ?? false;
                const isActive = keyData?.isActive ?? false;
                const isDefault = data?.defaults?.provider === provider.id;

                return (
                    <button
                        key={provider.id}
                        onClick={() => openAddDialog(provider)}
                        className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                        {/* Left: Logo + Name */}
                        <div className="flex items-center gap-3">
                            {getProviderLogo(provider.id)}
                            <span className="text-sm font-medium">{provider.name}</span>
                            {isDefault && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 rounded-md border-border/50">
                                    Default
                                </Badge>
                            )}
                            {keyData?.source === 'api' && (
                                <Badge variant="outline" title={keyData.connectionId ? `Connected via API (${keyData.connectionId})` : 'Connected via API'} className="text-[10px] px-1.5 py-0 h-4 rounded-md border-border/50">
                                    API
                                </Badge>
                            )}
                        </div>

                        {/* Right: Status + Chevron */}
                        <div className="flex items-center gap-2">
                            {hasKey ? (
                                <Badge className={`text-[10px] px-2 py-0.5 rounded-md ${isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                                    {isActive ? (
                                        <span className="flex items-center gap-1">
                                            <Check className="h-3 w-3" />
                                            Enabled
                                        </span>
                                    ) : 'Disabled'}
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                    Not configured
                                </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </button>
                );
            })}

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 pt-3">
                    <p className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Add/Edit Dialog - Cenpact Design */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                if (!open) resetDialog();
                else setDialogOpen(true);
            }}>
                <DialogContent className="rounded-xl sm:max-w-sm p-0 gap-0 border-border/50">
                    <DialogHeader className="px-4 py-3 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            {selectedProvider && getProviderLogo(selectedProvider.id)}
                            <DialogTitle className="text-sm font-medium">
                                {selectedProvider?.name}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-[11px] text-muted-foreground">
                            Get your key from{" "}
                            <a href={selectedProvider?.website} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                                {selectedProvider?.website?.replace('https://', '')}
                            </a>
                            {selectedProvider && data?.providers.find(p => p.provider === selectedProvider.id)?.source === 'api' && (
                                <span className="block mt-1">Connected via API — saving here moves it to dashboard keys.</span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-4 py-3 space-y-3">
                        {/* API Key Input */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">API Key</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? "text" : "password"}
                                    placeholder={selectedProvider?.keyPrefix || "sk-..."}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="h-8 pr-8 rounded-lg text-[11px] font-mono bg-muted/30 border-border/50"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-8 w-8 p-0"
                                    onClick={() => setShowKey(!showKey)}
                                >
                                    {showKey ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                                </Button>
                            </div>
                            {selectedProvider?.keyFormatHint && (
                                <p className="text-[10px] text-muted-foreground">{selectedProvider.keyFormatHint}</p>
                            )}
                        </div>

                        {/* Set as Default */}
                        <div className="flex items-center gap-2 pt-1">
                            <Switch
                                id="set-default"
                                checked={setAsDefault}
                                onCheckedChange={setSetAsDefault}
                                className="scale-75 data-[state=checked]:bg-foreground"
                            />
                            <Label htmlFor="set-default" className="text-[11px] cursor-pointer text-muted-foreground">
                                Set as project default
                            </Label>
                        </div>

                        {/* Enable/Disable toggle for existing keys */}
                        {existingKeyHint && (
                            <div className="flex items-center gap-2 pt-1">
                                <Switch
                                    id="provider-enabled"
                                    checked={isProviderActive}
                                    onCheckedChange={(checked) => {
                                        setIsProviderActive(checked);
                                        if (selectedProvider) {
                                            toggleMutation.mutate({ provider: selectedProvider.id, isActive: checked });
                                        }
                                    }}
                                    className="scale-75 data-[state=checked]:bg-emerald-500"
                                />
                                <Label htmlFor="provider-enabled" className="text-[11px] cursor-pointer text-muted-foreground">
                                    Provider enabled
                                </Label>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-4 py-3 border-t border-border/40 bg-muted/20">
                        <div className="w-full flex items-center justify-between">
                            {/* Delete button on the left */}
                            <div>
                                {existingKeyHint && selectedProvider && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            if (selectedProvider) {
                                                deleteKeyMutation.mutate(selectedProvider.id);
                                            }
                                        }}
                                        disabled={deleteKeyMutation.isPending}
                                        className="h-7 px-3 rounded-lg text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        {deleteKeyMutation.isPending ? (
                                            <Spinner className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <>
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                Remove
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                            {/* Cancel and Save on the right */}
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={resetDialog} className="h-7 px-3 rounded-lg text-[11px]">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddKey}
                                    disabled={(addKeyMutation.isPending || updateKeyMutation.isPending) || (!existingKeyHint && !apiKey)}
                                    className="h-7 px-3 rounded-lg text-[11px] bg-foreground text-background hover:bg-foreground/90"
                                >
                                    {addKeyMutation.isPending || updateKeyMutation.isPending ? (
                                        <Spinner className="h-3 w-3 animate-spin" />
                                    ) : (
                                        'Save'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
