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
import { OpenAI, Anthropic, Google, Mistral, Cohere, Perplexity } from "@lobehub/icons";
import { SUPPORTED_PROVIDERS, getModelsForProvider, type AIProviderConfig } from "@/lib/providers/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Image from "next/image";

// Provider logo mapping
const PROVIDER_LOGOS: Record<string, React.ReactNode> = {
    openai: <OpenAI size={20} />,
    anthropic: <Anthropic size={20} />,
    google: <Google size={20} />,
    mistral: <Mistral size={20} />,
    cohere: <Cohere size={20} />,
    perplexity: <Perplexity size={20} />,
    groq: <span className="text-[11px] font-bold">G</span>,
    together: <span className="text-[11px] font-bold">T</span>,
    openrouter: <span className="text-[11px] font-bold">OR</span>,
};

function getProviderLogo(providerId: string, size: 'sm' | 'md' = 'md') {
    const logo = PROVIDER_LOGOS[providerId];
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
                    <Badge variant="secondary" className="rounded-lg text-xs">
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
                                <Card key={provider.provider} className="relative rounded-lg border-border/50">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {getProviderLogo(provider.provider, 'sm')}
                                                <CardTitle className="text-sm font-medium">{provider.providerName}</CardTitle>
                                            </div>
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
                                                className="flex-1 h-7 text-xs rounded-lg"
                                                onClick={() => config && openAddDialog(config)}
                                            >
                                                <Key className="h-3 w-3 mr-1" />
                                                Update
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs rounded-lg text-red-500 hover:text-red-600"
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
                            className="justify-start h-10 rounded-lg border-dashed"
                            onClick={() => openAddDialog(provider)}
                        >
                            {getProviderLogo(provider.id, 'sm')}
                            <span>{provider.name}</span>
                        </Button>
                    ))}
                </div>
            </div>

            {/* Add/Edit Dialog - Cenpact Design */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                            </div>
                        </div>

                        {/* Model Selection */}
                        {selectedProvider && (
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Default Model</Label>
                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                    <SelectTrigger className="h-8 rounded-lg text-[11px] bg-muted/30 border-border/50">
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-lg">
                                        {getModelsForProvider(selectedProvider.id).map((model) => (
                                            <SelectItem key={model.id} value={model.id} className="text-[11px] py-1.5">
                                                <span>{model.name}</span>
                                                <span className="ml-1.5 text-muted-foreground">({model.type})</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

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
                    </div>

                    <DialogFooter className="px-4 py-3 border-t border-border/40 bg-muted/20">
                        <Button variant="ghost" onClick={resetDialog} className="h-7 px-3 rounded-lg text-[11px]">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddKey}
                            disabled={!apiKey || addKeyMutation.isPending}
                            className="h-7 px-3 rounded-lg text-[11px] bg-foreground text-background hover:bg-foreground/90"
                        >
                            {addKeyMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Save
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
