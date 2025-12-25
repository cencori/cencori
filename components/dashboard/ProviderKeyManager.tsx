"use client";

/**
 * Provider Key Manager Component
 * 
 * Allows users to manage their API keys for supported AI providers (BYOK).
 * Part of project settings.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Key, Loader2, Plus, Trash2, X } from "lucide-react";
import { SUPPORTED_PROVIDERS, getModelsForProvider, type AIProviderConfig } from "@/lib/providers/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ProviderKeyData {
    provider: string;
    providerName: string;
    hasKey: boolean;
    keyHint?: string;
    isActive: boolean;
    createdAt?: string;
}

interface ProviderKeysResponse {
    providers: ProviderKeyData[];
    defaults: {
        provider: string;
        model: string;
    };
}

interface ProviderKeyManagerProps {
    projectId: string;
}

export function ProviderKeyManager({ projectId }: ProviderKeyManagerProps) {
    const queryClient = useQueryClient();
    const [selectedProvider, setSelectedProvider] = useState<AIProviderConfig | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [selectedModel, setSelectedModel] = useState("");
    const [setAsDefault, setSetAsDefault] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Fetch provider keys
    const { data, isLoading } = useQuery<ProviderKeysResponse>({
        queryKey: ["provider-keys", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/provider-keys`);
            if (!res.ok) throw new Error("Failed to fetch provider keys");
            return res.json();
        },
    });

    // Add/update key mutation
    const addKeyMutation = useMutation({
        mutationFn: async (payload: { provider: string; apiKey: string; setAsDefault?: boolean; defaultModel?: string }) => {
            const res = await fetch(`/api/projects/${projectId}/provider-keys`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to save key");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["provider-keys", projectId] });
            toast.success("Provider key saved");
            resetDialog();
        },
        onError: () => toast.error("Failed to save provider key"),
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["provider-keys", projectId] });
        },
    });

    const resetDialog = () => {
        setDialogOpen(false);
        setSelectedProvider(null);
        setApiKey("");
        setShowKey(false);
        setSelectedModel("");
        setSetAsDefault(false);
    };

    const handleAddKey = () => {
        if (!selectedProvider || !apiKey) return;
        addKeyMutation.mutate({
            provider: selectedProvider.id,
            apiKey,
            setAsDefault: setAsDefault,
            defaultModel: selectedModel || undefined,
        });
    };

    const openAddDialog = (provider: AIProviderConfig) => {
        setSelectedProvider(provider);
        const models = getModelsForProvider(provider.id);
        if (models.length > 0) setSelectedModel(models[0].id);
        setDialogOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const configuredProviders = data?.providers.filter(p => p.hasKey) || [];
    const availableProviders = SUPPORTED_PROVIDERS.filter(p => !data?.providers.find(dp => dp.provider === p.id && dp.hasKey));

    return (
        <div className="space-y-6">
            {/* Current Default */}
            {data?.defaults && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Default:</span>
                    <Badge variant="secondary" className="rounded-none text-xs">
                        {data.defaults.provider} / {data.defaults.model}
                    </Badge>
                </div>
            )}

            {/* Configured Providers */}
            {configuredProviders.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connected Providers</h4>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {configuredProviders.map((provider) => {
                            const config = SUPPORTED_PROVIDERS.find(p => p.id === provider.provider);
                            return (
                                <Card key={provider.provider} className="relative rounded-none border-border/50">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-medium">{provider.providerName}</CardTitle>
                                            <Switch
                                                checked={provider.isActive}
                                                onCheckedChange={(checked: boolean) => toggleMutation.mutate({ provider: provider.provider, isActive: checked })}
                                                className="scale-75"
                                            />
                                        </div>
                                        <CardDescription className="text-xs font-mono">
                                            {provider.keyHint}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-7 text-xs rounded-none"
                                                onClick={() => config && openAddDialog(config)}
                                            >
                                                <Key className="h-3 w-3 mr-1" />
                                                Update
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs rounded-none text-red-500 hover:text-red-600"
                                                onClick={() => {
                                                    if (confirm("Remove this provider key?")) {
                                                        deleteKeyMutation.mutate(provider.provider);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available Providers */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Provider</h4>
                <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                    {availableProviders.map((provider) => (
                        <Button
                            key={provider.id}
                            variant="outline"
                            className="justify-start h-10 rounded-none border-dashed"
                            onClick={() => openAddDialog(provider)}
                        >
                            <Plus className="h-3 w-3 mr-2" />
                            {provider.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="rounded-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            {selectedProvider?.name} API Key
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Enter your API key from{" "}
                            <a href={selectedProvider?.website} target="_blank" rel="noopener noreferrer" className="underline">
                                {selectedProvider?.website}
                            </a>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* API Key Input */}
                        <div className="space-y-2">
                            <Label className="text-xs">API Key</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? "text" : "password"}
                                    placeholder={selectedProvider?.keyPrefix ? `${selectedProvider.keyPrefix}...` : "Enter API key"}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="pr-10 rounded-none text-xs font-mono"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => setShowKey(!showKey)}
                                >
                                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                            </div>
                        </div>

                        {/* Model Selection */}
                        {selectedProvider && (
                            <div className="space-y-2">
                                <Label className="text-xs">Default Model</Label>
                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                    <SelectTrigger className="rounded-none text-xs">
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-none">
                                        {getModelsForProvider(selectedProvider.id).map((model) => (
                                            <SelectItem key={model.id} value={model.id} className="text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span>{model.name}</span>
                                                    <span className="text-muted-foreground">({model.type})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Set as Default */}
                        <div className="flex items-center gap-2">
                            <Switch
                                id="set-default"
                                checked={setAsDefault}
                                onCheckedChange={setSetAsDefault}
                                className="scale-75"
                            />
                            <Label htmlFor="set-default" className="text-xs cursor-pointer">
                                Set as default provider for this project
                            </Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={resetDialog} className="rounded-none text-xs">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddKey}
                            disabled={!apiKey || addKeyMutation.isPending}
                            className="rounded-none text-xs"
                        >
                            {addKeyMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                                <Check className="h-3 w-3 mr-1" />
                            )}
                            Save Key
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
