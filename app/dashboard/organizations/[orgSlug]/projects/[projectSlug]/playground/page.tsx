"use client";

import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Play, AlertCircle, Terminal } from "lucide-react";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { Skeleton } from "@/components/ui/skeleton";

interface PlaygroundPageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

const MODELS = [
    { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "Anthropic" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku", provider: "Anthropic" },
    { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash", provider: "Google" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "Google" },
];

// Hook to check if project has API keys (with caching)
function useProjectKeysCheck(orgSlug: string, projectSlug: string, environment: string) {
    return useQuery({
        queryKey: ["projectKeysCheck", orgSlug, projectSlug, environment],
        queryFn: async () => {
            const { data: orgData } = await supabase
                .from("organizations")
                .select("id")
                .eq("slug", orgSlug)
                .single();

            if (!orgData) throw new Error("Organization not found");

            const { data: projectData } = await supabase
                .from("projects")
                .select("id")
                .eq("slug", projectSlug)
                .eq("organization_id", orgData.id)
                .single();

            if (!projectData) throw new Error("Project not found");

            const { data: keys } = await supabase
                .from("api_keys")
                .select("id")
                .eq("project_id", projectData.id)
                .eq("environment", environment)
                .is("revoked_at", null)
                .limit(1);

            return {
                hasKeys: Boolean(keys && keys.length > 0),
                projectId: projectData.id,
            };
        },
        staleTime: 60 * 1000, // Cache for 1 minute
    });
}

export default function PlaygroundPage({ params }: PlaygroundPageProps) {
    const { orgSlug, projectSlug } = use(params);
    const router = useRouter();
    const { environment } = useEnvironment();

    const [apiKey, setApiKey] = useState("");
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedModel, setSelectedModel] = useState("gpt-4o");
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);
    const [cost, setCost] = useState<number | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [tokens, setTokens] = useState<{ prompt: number; completion: number } | null>(null);

    // Check for API keys with caching - INSTANT ON REVISIT!
    const { data: keysData, isLoading: checkingKeys } = useProjectKeysCheck(orgSlug, projectSlug, environment);
    const hasKeys = keysData?.hasKeys ?? false;

    const handleSend = async () => {
        if (!message.trim() || !apiKey.trim()) return;

        setLoading(true);
        setResponse("");
        setCost(null);
        setLatency(null);
        setTokens(null);

        const startTime = Date.now();

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CENCORI_API_KEY": apiKey.trim(),
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [{ role: "user", content: message }],
                    stream: false,
                }),
            });

            const endTime = Date.now();

            if (!res.ok) {
                const errorData = await res.json();
                setResponse(`Error: ${errorData.error || "Failed to get response"}`);
                return;
            }

            const data = await res.json();

            setResponse(data.content || "No response");
            setCost(data.cost_usd || 0);
            setLatency(endTime - startTime);
            setTokens({
                prompt: data.usage?.prompt_tokens || 0,
                completion: data.usage?.completion_tokens || 0,
            });
        } catch (error) {
            console.error("Error calling API:", error);
            setResponse(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    };

    const envName = environment === "test" ? "Development" : "Production";

    if (checkingKeys) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-64 mt-1" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-[400px]" />
                    <Skeleton className="h-[400px]" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-base font-medium">Playground</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Test and compare AI models in a secure environment.</p>
            </div>

            {/* API Key Warning */}
            {!hasKeys && (
                <div className="mb-4 flex items-center gap-2 p-2.5 rounded-md border border-amber-500/20 bg-amber-500/5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        No {envName} API keys found.{" "}
                        <button
                            className="underline hover:no-underline"
                            onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/api-keys`)}
                        >
                            Create one first
                        </button>
                    </p>
                </div>
            )}

            {/* API Key Input */}
            <div className="mb-6">
                <Label className="text-xs text-muted-foreground mb-1.5 block">API Key</Label>
                <div className="flex gap-2 max-w-md">
                    <div className="relative flex-1">
                        <Input
                            type={apiKeyVisible ? "text" : "password"}
                            placeholder={`cen_${environment === "test" ? "test_" : ""}...`}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="h-8 text-xs font-mono pr-14"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setApiKeyVisible(!apiKeyVisible)}
                            className="absolute right-0 top-0 h-8 text-xs px-2"
                        >
                            {apiKeyVisible ? "Hide" : "Show"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Panel */}
                <div className="space-y-4">
                    <div className="rounded-md border border-border/40 bg-card p-4">
                        {/* Model Selector */}
                        <div className="mb-4">
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Model</Label>
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MODELS.map((model) => (
                                        <SelectItem key={model.value} value={model.value} className="text-xs">
                                            <div className="flex items-center gap-2">
                                                <span>{model.label}</span>
                                                <Badge variant="outline" className="text-[9px] h-4 px-1">
                                                    {model.provider}
                                                </Badge>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Prompt Input */}
                        <div className="mb-4">
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Prompt</Label>
                            <Textarea
                                placeholder="Enter your prompt here..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="min-h-[200px] text-xs font-mono resize-none"
                            />
                        </div>

                        {/* Run Button */}
                        <Button
                            onClick={handleSend}
                            disabled={loading || !message.trim() || !apiKey.trim()}
                            className="w-full h-8 text-xs"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-1.5 h-3 w-3" />
                                    Run
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Quick Prompts */}
                    <div className="rounded-md border border-border/40 bg-card p-4">
                        <h3 className="text-xs font-medium mb-3">Quick prompts</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: "Explain quantum computing", prompt: "Explain quantum computing in simple terms" },
                                { label: "Write a haiku", prompt: "Write a haiku about coding" },
                                { label: "Serverless benefits", prompt: "What are the benefits of serverless architecture?" },
                                { label: "Translate to Spanish", prompt: "Translate 'Hello, how are you?' to Spanish" }
                            ].map((item) => (
                                <Button
                                    key={item.label}
                                    variant="outline"
                                    size="sm"
                                    className="h-auto py-2 px-3 text-xs justify-start text-left"
                                    onClick={() => setMessage(item.prompt)}
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Output Panel */}
                <div className="rounded-md border border-border/40 bg-card p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-medium">Response</h3>
                        {latency !== null && (
                            <Badge variant="outline" className="text-[10px] h-5 font-mono">
                                {latency}ms
                            </Badge>
                        )}
                    </div>

                    {/* Response Area */}
                    <div className="flex-1 min-h-[280px] rounded-md bg-secondary/30 border border-border/40 p-3 font-mono text-xs overflow-auto">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <p className="text-[11px]">Generating...</p>
                            </div>
                        ) : response ? (
                            <div className="whitespace-pre-wrap break-words">{response}</div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                                <Terminal className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-[11px]">Response will appear here</p>
                            </div>
                        )}
                    </div>

                    {/* Metrics */}
                    {(cost !== null || tokens !== null) && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-md border border-border/40 p-2.5">
                                <p className="text-[10px] text-muted-foreground mb-0.5">Cost</p>
                                <p className="text-sm font-medium font-mono">${cost?.toFixed(5)}</p>
                            </div>
                            <div className="rounded-md border border-border/40 p-2.5">
                                <p className="text-[10px] text-muted-foreground mb-0.5">Input</p>
                                <p className="text-sm font-medium font-mono">{tokens?.prompt.toLocaleString()}</p>
                            </div>
                            <div className="rounded-md border border-border/40 p-2.5">
                                <p className="text-[10px] text-muted-foreground mb-0.5">Output</p>
                                <p className="text-sm font-medium font-mono">{tokens?.completion.toLocaleString()}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
