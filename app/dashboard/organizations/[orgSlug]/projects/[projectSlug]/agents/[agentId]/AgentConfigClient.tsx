"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PencilSquareIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import {
    Power,
    Eye,
    EyeOff,
    Copy,
    RefreshCw,
    Trash2,
    ShieldCheck,
    ShieldAlert,
    Loader2,
    ArrowLeft
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
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
import { generateAgentKey, getAgentTelemetry, type AgentTelemetry, updateAgentConfig, updateAgentName, deleteAgent } from "./actions";
import { SUPPORTED_PROVIDERS } from "@/lib/providers/config";
import { supabase } from "@/lib/supabaseClient";

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

function Sparkline({ values, className }: { values: number[]; className?: string }) {
    if (values.length === 0) {
        return <div className="h-8 w-full rounded bg-muted/30" />;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = values
        .map((v, i) => {
            const x = (i / Math.max(values.length - 1, 1)) * 100;
            const y = 100 - ((v - min) / range) * 100;
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <svg viewBox="0 0 100 100" className={`h-8 w-full ${className || ""}`} preserveAspectRatio="none" aria-hidden="true">
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
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
    const [telemetry, setTelemetry] = useState<AgentTelemetry | null>(null);
    const [telemetryLoading, setTelemetryLoading] = useState(true);
    const telemetryKeyIdsRef = useRef<Set<string>>(new Set());
    const telemetryRefreshLockRef = useRef(false);
    const [agentName, setAgentName] = useState(agent.name);
    const [editingName, setEditingName] = useState(false);
    const [pendingAgentName, setPendingAgentName] = useState(agent.name);

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
            } catch {
                toast.error("Failed to generate key");
            }
        });
    };

    const handleDelete = async () => {
        try {
            await deleteAgent(agent.id, orgSlug, projectSlug);
            toast.success("Agent deleted");
        } catch {
            toast.error("Failed to delete agent");
        }
    };

    const handleSaveAgentName = () => {
        const nextName = pendingAgentName.trim();
        if (!nextName) {
            toast.error("Agent name cannot be empty");
            return;
        }
        if (nextName === agentName) {
            setEditingName(false);
            return;
        }

        startTransition(async () => {
            try {
                await updateAgentName(agent.id, window.location.pathname, nextName);
                setAgentName(nextName);
                setPendingAgentName(nextName);
                setEditingName(false);
                toast.success("Agent name updated");
            } catch {
                toast.error("Failed to update agent name");
            }
        });
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
    const keyDisplay = isMaskedKey ? '<YOUR_KEY>' : (apiKey || '<YOUR_KEY>');

    const getConnectCommand = (blueprint: string) => {
        const envVars = `# Step 2: Connect to Cencori\nexport OPENAI_BASE_URL=https://cencori.com/api/v1\nexport OPENAI_API_KEY=${keyDisplay}\nexport CENCORI_AGENT_ID=${agent.id}`;
        switch (blueprint) {
            case 'openclaw':
                return `# Step 1: Install OpenClaw\ncurl -sSL https://openclaw.ai/install.sh | bash\n\n${envVars}\n\n# Step 3: Run\nopenclaw onboard`;
            case 'n8n':
                return `# Step 1: Install n8n\nnpx n8n\n\n${envVars}`;
            case 'autogpt':
                return `# Step 1: Install AutoGPT\npip install autogpt\n\n${envVars}\n\n# Step 3: Run\nautogpt run`;
            case 'crewai':
                return `# Step 1: Install CrewAI\npip install crewai\n\n${envVars}`;
            case 'python-interpreter':
                return `# Step 1: Install dependencies\npip install openai\n\n${envVars}`;
            default:
                return `${envVars}`;
        }
    };

    const connectCommand = getConnectCommand(agent.blueprint);

    useEffect(() => {
        let cancelled = false;

        const loadTelemetry = async () => {
            if (telemetryRefreshLockRef.current) return;
            telemetryRefreshLockRef.current = true;
            try {
                const data = await getAgentTelemetry(agent.id);
                if (!cancelled) {
                    setTelemetry(data);
                    telemetryKeyIdsRef.current = new Set(data.apiKeyIds);
                    setTelemetryLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setTelemetryLoading(false);
                }
            } finally {
                telemetryRefreshLockRef.current = false;
            }
        };

        loadTelemetry();
        const timer = setInterval(loadTelemetry, 30000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [agent.id]);

    useEffect(() => {
        const channel = supabase
            .channel(`agent-telemetry-${agent.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "ai_requests",
                    filter: `project_id=eq.${agent.project_id}`,
                },
                async (payload: { new: { api_key_id?: string } }) => {
                    const apiKeyId = payload.new.api_key_id;
                    if (!apiKeyId) return;
                    if (!telemetryKeyIdsRef.current.has(apiKeyId)) return;
                    if (telemetryRefreshLockRef.current) return;
                    try {
                        telemetryRefreshLockRef.current = true;
                        const data = await getAgentTelemetry(agent.id);
                        setTelemetry(data);
                        telemetryKeyIdsRef.current = new Set(data.apiKeyIds);
                        setTelemetryLoading(false);
                    } finally {
                        telemetryRefreshLockRef.current = false;
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [agent.id, agent.project_id]);

    const telemetryCards = [
        {
            label: "Req/s",
            value: telemetry ? telemetry.reqPerSec.toFixed(2) : "0.00",
            points: telemetry?.points.map((p) => p.reqPerSec) || [],
            color: "text-cyan-400",
        },
        {
            label: "P95 latency",
            value: telemetry ? `${telemetry.p95LatencyMs} ms` : "0 ms",
            points: telemetry?.points.map((p) => p.p95LatencyMs) || [],
            color: "text-amber-400",
        },
        {
            label: "Error rate",
            value: telemetry ? `${telemetry.errorRatePct.toFixed(1)}%` : "0.0%",
            points: telemetry?.points.map((p) => p.errorRatePct) || [],
            color: "text-rose-400",
        },
        {
            label: "Tokens/min",
            value: telemetry ? Math.round(telemetry.tokensPerMin).toLocaleString() : "0",
            points: telemetry?.points.map((p) => p.tokensPerMin) || [],
            color: "text-emerald-400",
        },
        {
            label: "Cost today",
            value: telemetry ? `$${telemetry.costTodayUsd.toFixed(4)}` : "$0.0000",
            points: telemetry?.points.map((p) => p.costUsd) || [],
            color: "text-violet-400",
        },
    ];

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
                            {editingName ? (
                                <div className="flex items-center gap-1">
                                    <Input
                                        value={pendingAgentName}
                                        onChange={(e) => setPendingAgentName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleSaveAgentName();
                                            }
                                            if (e.key === "Escape") {
                                                e.preventDefault();
                                                setPendingAgentName(agentName);
                                                setEditingName(false);
                                            }
                                        }}
                                        className="h-8 w-56 text-sm"
                                        autoFocus
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={handleSaveAgentName}
                                        disabled={isPending}
                                        aria-label="Save agent name"
                                    >
                                        <CheckIcon className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => {
                                            setPendingAgentName(agentName);
                                            setEditingName(false);
                                        }}
                                        disabled={isPending}
                                        aria-label="Cancel editing agent name"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        onClick={() => setEditingName(true)}
                                        aria-label="Edit agent name"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                    </Button>
                                    <span>{agentName}</span>
                                </div>
                            )}
                            <Badge
                                variant="outline"
                                className={`h-5 px-1.5 text-[10px] border ${isActive
                                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                                    : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                                    }`}
                            >
                                {isActive ? "Actived" : "Deactivated"}
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
                        {isActive ? "Deactivate" : "Activate"}
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Live Feed</TabsTrigger>
                    <TabsTrigger value="settings">Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                            {telemetryCards.map((card) => (
                                <Card key={card.label}>
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{card.label}</span>
                                            {telemetryLoading && (
                                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="text-sm font-semibold">{card.value}</div>
                                        <Sparkline values={card.points} className={card.color} />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <AgentLiveFeed agentId={agent.id} />

                        {/* Connection Status Card */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Status</span>
                                    <div className={`flex items-center gap-1.5 ${isActive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                        <span className="relative flex h-2 w-2">
                                            {isActive && (
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            )}
                                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
                                        </span>
                                        <span>{isActive ? "Online" : "Inactive"}</span>
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
                                            <div className="pr-6 break-all space-y-1">
                                                {connectCommand.split('\n').map((line, i) => (
                                                    <div key={i}><span className="text-green-500">$</span> {line}</div>
                                                ))}
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
                </TabsContent>

                <TabsContent value="settings" className="space-y-8 w-full">

                    {/* 1. Identity */}
                    <section className="space-y-3">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-medium">Identity & Credentials</h2>
                            <p className="text-xs text-muted-foreground">Manage the key and routing identity used by this agent runtime.</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/40 space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-medium">Agent Key</Label>
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

                            <div className="px-4 py-3 space-y-2 bg-muted/10">
                                <Label className="text-xs font-medium">CENCORI_AGENT_ID</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={agent.id}
                                        readOnly
                                        className="font-mono text-xs h-9"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 p-0"
                                        onClick={() => {
                                            navigator.clipboard.writeText(agent.id);
                                            toast.success("Agent ID copied");
                                        }}
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Optional override for multi-agent routing. Usually auto-resolved from API key.
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
                        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/40 space-y-2">
                                <Label className="text-xs font-medium">Model ID</Label>
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
                            <div className="flex justify-end px-4 py-2 bg-muted/20">
                                <Button
                                    size="sm"
                                    onClick={handleSaveModel}
                                    disabled={isPending}
                                    className="h-8 text-xs"
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
                            <p className="text-xs text-muted-foreground">Define the agent&apos;s persona and instructions.</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                            <div className="px-4 py-2 border-b border-border/40 bg-muted/10">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Runtime instruction layer</p>
                            </div>
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
                                    className="h-8 text-xs"
                                >
                                    {isPending && savingAction === 'prompt' && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                    Save Prompt
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* 4. Danger Zone */}
                    <section className="space-y-3 pt-4 border-t border-border/40">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-medium text-red-500">Danger Zone</h2>
                            <p className="text-xs text-muted-foreground">High-impact operations with irreversible outcomes.</p>
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
