"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
    Power,
    Eye,
    EyeOff,
    Copy,
    RefreshCw,
    Trash2,
    ShieldCheck,
    ShieldAlert,
    Save,
    Terminal,
    Loader2,
    ArrowLeft
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { OpenClawLogo, AutoGPTLogo, N8nLogo, CrewAILogo, PythonLogo, CustomAgentLogo } from "@/components/icons/BrandIcons";
import AgentLiveFeed from "./AgentLiveFeed";
import { generateAgentKey, updateAgentConfig, deleteAgent } from "./actions";
import { SUPPORTED_PROVIDERS } from "@/lib/providers/config";

interface AgentConfigClientProps {
    agent: {
        id: string;
        name: string;
        blueprint: string;
        is_active: boolean;
        shadow_mode: boolean;
        project_id: string;
        system_prompt?: string;
        model?: string;
    };
    apiKey: string | null; // This might be null initially
    orgSlug: string;
    projectSlug: string;
}

export default function AgentConfigClient({ agent, apiKey: initialKey, orgSlug, projectSlug }: AgentConfigClientProps) {
    const [isPending, startTransition] = useTransition();

    // State
    const [shadowMode, setShadowMode] = useState(agent.shadow_mode);
    const [isActive, setIsActive] = useState(agent.is_active);
    const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt || "");
    const [selectedModel, setSelectedModel] = useState(agent.model || "gpt-4o");

    const [apiKey, setApiKey] = useState(initialKey);
    const [keyVisible, setKeyVisible] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    // Persist changes when toggles change
    const handleToggleActive = (val: boolean) => {
        setIsActive(val);
        startTransition(async () => {
            await updateAgentConfig(agent.id, window.location.pathname, { is_active: val });
            toast.success(val ? "Agent Activated" : "Agent Stopped");
        });
    };

    const handleToggleShadow = (val: boolean) => {
        setShadowMode(val);
        startTransition(async () => {
            await updateAgentConfig(agent.id, window.location.pathname, { shadow_mode: val });
            toast.success(val ? "Shadow Mode Enabled" : "Shadow Mode Disabled");
        });
    };

    const [savingAction, setSavingAction] = useState<string | null>(null);

    const handleSaveModel = () => {
        setSavingAction('model');
        startTransition(async () => {
            await updateAgentConfig(agent.id, window.location.pathname, {
                model: selectedModel
            });
            toast.success("Model Configuration Saved");
            setSavingAction(null);
        });
    };

    const handleSavePrompt = () => {
        setSavingAction('prompt');
        startTransition(async () => {
            await updateAgentConfig(agent.id, window.location.pathname, {
                system_prompt: systemPrompt
            });
            toast.success("System Prompt Saved");
            setSavingAction(null);
        });
    };

    const handleGenerateKey = () => {
        startTransition(async () => {
            try {
                const newKey = await generateAgentKey(agent.id, agent.project_id);
                setApiKey(newKey);
                setKeyVisible(true);
                toast.success("New Agent Key Generated");
            } catch (e) {
                toast.error("Failed to generate key");
            }
        });
    };

    const handleDelete = async () => {
        try {
            await deleteAgent(agent.id, orgSlug, projectSlug);
            toast.success("Agent deleted");
        } catch (e) {
            toast.error("Failed to delete agent");
        }
    };

    // Helper to get Blueprint Icon
    const BlueprintIcon = ({ className }: { className?: string }) => {
        switch (agent.blueprint) {
            case 'openclaw': return <OpenClawLogo className={className} />;
            case 'autogpt': return <AutoGPTLogo className={className} />;
            case 'n8n': return <N8nLogo className={className} />;
            case 'crewai': return <CrewAILogo className={className} />;
            case 'python-interpreter': return <PythonLogo className={className} />;
            default: return <CustomAgentLogo className={className} />;
        }
    };

    const isMaskedKey = apiKey === "cake_*****************";
    const connectCommand = isMaskedKey
        ? `npx openclaw connect --key=<YOUR_KEY>`
        : `npx openclaw connect --key=${apiKey || "<YOUR_KEY>"}`;

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground pl-0"
                    onClick={() => window.history.back()}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Agents
                </Button>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                        <BlueprintIcon className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            {agent.name}
                            <Badge
                                variant="outline"
                                className={`h-5 px-1.5 text-[10px] border ${isActive
                                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                                    : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                                    }`}
                            >
                                {isActive ? "Active" : "Stopped"}
                            </Badge>
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {agent.blueprint === 'openclaw' ? 'Autonomous Desktop Operator' : 'General Purpose Agent'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={isActive ? "destructive" : "default"}
                        size="sm"
                        className="h-9 gap-2"
                        onClick={() => handleToggleActive(!isActive)}
                        disabled={isPending}
                    >
                        <Power className="w-4 h-4" />
                        {isActive ? "Stop Agent" : "Start Agent"}
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Live Feed</TabsTrigger>
                    <TabsTrigger value="settings">Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <AgentLiveFeed agentId={agent.id} />
                        </div>
                        <div className="space-y-6 pt-8">
                            {/* Connection Status Card */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">Status</span>
                                        {/* TODO: Hook this up to real agent_sessions table */}
                                        <div className="flex items-center gap-1.5 text-amber-500">
                                            <span className="relative flex h-2 w-2">
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                            </span>
                                            <span>Waiting for connection...</span>
                                        </div>
                                    </div>

                                    {!apiKey ? (
                                        <div className="rounded bg-muted/50 p-3 text-[10px] text-muted-foreground">
                                            ⚠️ No API Key generated. Go to Configuration to generate one.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Connect Terminal</Label>
                                            <div className="relative rounded-md bg-zinc-950 p-3 font-mono text-[10px] text-zinc-100 border border-zinc-800">
                                                <div className="absolute right-2 top-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-4 w-4 text-zinc-400 hover:text-white"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(connectCommand);
                                                            toast.success("Command copied");
                                                        }}
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                                <div className="pr-6 break-all">
                                                    <span className="text-green-500">$</span> {connectCommand}
                                                </div>
                                            </div>
                                            {isMaskedKey && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    Running with existing key. Regenerate if you lost it.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Shadow Mode Toggle */}
                            <div className={`rounded-lg border bg-card p-4 transition-colors ${shadowMode ? "border-primary/30 bg-primary/5" : "border-border/60"}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {shadowMode ? <ShieldCheck className="w-4 h-4 text-primary" /> : <ShieldAlert className="w-4 h-4 text-muted-foreground" />}
                                        <span className="text-sm font-medium">Shadow Mode</span>
                                    </div>
                                    <Switch checked={shadowMode} onCheckedChange={handleToggleShadow} disabled={isPending} />
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    {shadowMode
                                        ? "Agent requires approval for risky actions."
                                        : "Agent runs fully autonomously (Risky)."}
                                </p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-8 w-full">

                    {/* 1. Identity */}
                    <section className="space-y-3">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-medium">Identity & Credentials</h2>
                            <p className="text-xs text-muted-foreground">Manage the agent's unique identity key.</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs">Agent Key</Label>
                                    {!apiKey && (
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleGenerateKey} disabled={isPending}>
                                            Generate Key
                                        </Button>
                                    )}
                                </div>

                                {apiKey ? (
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                value={isMaskedKey
                                                    ? "•••••••••••••••••••••••• (Active)"
                                                    : (keyVisible ? apiKey : "cake_••••••••••••••••••••••••••••")
                                                }
                                                readOnly
                                                className={`font-mono text-xs pr-10 h-9 ${isMaskedKey ? "text-muted-foreground italic" : ""}`}
                                            />
                                            {!isMaskedKey && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full w-9"
                                                    onClick={() => setKeyVisible(!keyVisible)}
                                                >
                                                    {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                            )}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 w-9 p-0"
                                            onClick={() => {
                                                if (isMaskedKey) {
                                                    toast.error("Cannot copy hidden key. Regenerate to see new key.");
                                                } else {
                                                    navigator.clipboard.writeText(apiKey);
                                                    toast.success("Copied to clipboard");
                                                }
                                            }}
                                            disabled={isMaskedKey}
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 w-9 p-0 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                                            onClick={handleGenerateKey}
                                            title="Roll Key"
                                            disabled={isPending}
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="h-9 rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground bg-muted/20">
                                        No key generated yet
                                    </div>
                                )}

                                <p className="text-[10px] text-muted-foreground">
                                    {isMaskedKey
                                        ? "Key is active but hidden for security. Regenerate if you need a new one."
                                        : "Use this key to authenticate your local OpenClaw instance."}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 2. Model Configuration */}
                    <section className="space-y-3">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-medium">Model Configuration</h2>
                            <p className="text-xs text-muted-foreground">Select the underlying model for this agent.</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Model ID</Label>
                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUPPORTED_PROVIDERS.map((provider) => (
                                            <SelectGroup key={provider.id}>
                                                <SelectLabel className="flex items-center gap-2 text-xs font-semibold">
                                                    {provider.name}
                                                </SelectLabel>
                                                {provider.models.filter(m => m.type === 'chat' || m.type === 'reasoning' || m.type === 'code').map((model) => (
                                                    <SelectItem key={model.id} value={model.id} className="text-xs">
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button
                                    size="sm"
                                    onClick={handleSaveModel}
                                    disabled={isPending}
                                >
                                    {isPending && savingAction === 'model' && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                    Save Configuration
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* 3. System Prompt */}
                    <section className="space-y-3">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-medium">System Prompt</h2>
                            <p className="text-xs text-muted-foreground">Define the agent's persona and instructions.</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                            <Textarea
                                className="min-h-[200px] font-mono text-xs border-0 focus-visible:ring-0 resize-none p-4"
                                placeholder="You are a helpful assistant..."
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                            />
                            <div className="bg-muted/40 p-2 border-t border-border/40 flex justify-end">
                                <Button
                                    size="sm"
                                    onClick={handleSavePrompt}
                                    disabled={isPending}
                                >
                                    {isPending && savingAction === 'prompt' && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                    Save Prompt
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* 4. Danger Zone */}
                    <section className="space-y-3 pt-4 border-t">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-medium text-red-500">Danger Zone</h2>
                        </div>
                        <div className="rounded-lg border border-red-200/50 bg-red-50/5 p-4 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium">Delete Agent</p>
                                <p className="text-[10px] text-muted-foreground">Unlike shadow mode, this cannot be undone.</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="gap-2">
                                        <Trash2 className="w-3 h-3" />
                                        Delete Agent
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the
                                            agent <strong>{agent.name}</strong> and all of its history.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                                            Delete Agent
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </section>

                </TabsContent>
            </Tabs>
        </div>
    );
}
