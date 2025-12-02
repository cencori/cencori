"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Play, AlertCircle, Key, Terminal, Cpu, MessageSquare, Zap } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";

interface PlaygroundPageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

const MODELS = [
    { value: "gpt-4o", label: "GPT-4 Turbo", provider: "OpenAI" },
    { value: "gpt-4o-mini", label: "GPT-4 Mini", provider: "OpenAI" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus", provider: "Anthropic" },
    { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet", provider: "Anthropic" },
    { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash", provider: "Google" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "Google" },
];

export default function PlaygroundPage({ params }: PlaygroundPageProps) {
    const router = useRouter();
    const { environment } = useEnvironment();

    const [orgSlug, setOrgSlug] = useState<string | null>(null);
    const [projectSlug, setProjectSlug] = useState<string | null>(null);
    const [hasKeys, setHasKeys] = useState(false);
    const [checkingKeys, setCheckingKeys] = useState(true);

    // User manually enters API key
    const [apiKey, setApiKey] = useState("");
    const [apiKeyVisible, setApiKeyVisible] = useState(false);

    const [message, setMessage] = useState("");
    const [selectedModel, setSelectedModel] = useState("gpt-4o");
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);
    const [cost, setCost] = useState<number | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [tokens, setTokens] = useState<{ prompt: number; completion: number } | null>(null);

    // Resolve params
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const resolved = await params;
                if (mounted && resolved) {
                    setOrgSlug(resolved.orgSlug);
                    setProjectSlug(resolved.projectSlug);
                }
            } catch (e) {
                console.error("Failed to resolve params:", e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [params]);

    // Check if API keys exist (to show helpful message)
    useEffect(() => {
        if (!orgSlug || !projectSlug) return;

        const checkKeys = async () => {
            try {
                setCheckingKeys(true);

                const { data: orgData } = await supabase
                    .from("organizations")
                    .select("id")
                    .eq("slug", orgSlug)
                    .single();

                if (!orgData) {
                    setCheckingKeys(false);
                    return;
                }

                const { data: projectData } = await supabase
                    .from("projects")
                    .select("id")
                    .eq("slug", projectSlug)
                    .eq("organization_id", orgData.id)
                    .single();

                if (!projectData) {
                    setCheckingKeys(false);
                    return;
                }

                // Check if keys exist for this environment
                const { data: keys } = await supabase
                    .from("api_keys")
                    .select("id")
                    .eq("project_id", projectData.id)
                    .eq("environment", environment)
                    .is("revoked_at", null)
                    .limit(1);

                setHasKeys(Boolean(keys && keys.length > 0));
                setCheckingKeys(false);
            } catch (error) {
                console.error("Error checking keys:", error);
                setCheckingKeys(false);
            }
        };

        checkKeys();
    }, [orgSlug, projectSlug, environment]);

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

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Test, iterate, and compare AI models in a secure environment.
                    </p>
                </div>
                <Badge variant={environment === "production" ? "default" : "secondary"} className="self-start md:self-center px-4 py-1.5 text-sm">
                    {environment === "production" ? "Production Environment" : "Development Environment"}
                </Badge>
            </div>

            {/* API Key Input Section */}
            {!checkingKeys && !hasKeys && (
                <Alert className="mb-8 border-yellow-500/20 bg-yellow-500/5">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-yellow-500">
                        No {envName} API keys found. {" "}
                        <Button
                            variant="link"
                            className="p-0 h-auto text-yellow-500 underline"
                            onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/api-keys`)}
                        >
                            Create one first
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-8">
                {/* API Key Section */}
                <TechnicalBorder className="w-full">
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Key className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Authentication</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enter your {envName.toLowerCase()} API key to authenticate requests. Keys are never stored.
                        </p>
                        <div className="flex gap-2 max-w-2xl">
                            <div className="relative flex-1">
                                <Input
                                    type={apiKeyVisible ? "text" : "password"}
                                    placeholder={`cen_${environment === "test" ? "test_" : ""}...`}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="rounded-none font-mono text-sm pr-20 bg-background/50"
                                />
                                <div className="absolute right-0 top-0 h-full">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setApiKeyVisible(!apiKeyVisible)}
                                        className="h-full rounded-none px-4 hover:bg-transparent hover:text-primary"
                                    >
                                        {apiKeyVisible ? "Hide" : "Show"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TechnicalBorder>

                {/* Main Playground Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Input Side */}
                    <div className="lg:col-span-5 space-y-6">
                        <TechnicalBorder className="h-full">
                            <div className="p-6 h-full flex flex-col">
                                <div className="flex items-center gap-2 mb-6">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                    <h2 className="text-lg font-semibold">Request Configuration</h2>
                                </div>

                                <div className="space-y-6 flex-1">
                                    {/* Model Selector */}
                                    <div className="space-y-2">
                                        <Label htmlFor="model" className="text-xs uppercase tracking-wider text-muted-foreground">Model</Label>
                                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                                            <SelectTrigger id="model" className="rounded-none bg-background/50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-none">
                                                {MODELS.map((model) => (
                                                    <SelectItem key={model.value} value={model.value} className="rounded-none">
                                                        <div className="flex items-center justify-between w-full gap-4">
                                                            <span>{model.label}</span>
                                                            <Badge variant="outline" className="text-[10px] h-5">
                                                                {model.provider}
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Message Input */}
                                    <div className="space-y-2 flex-1 flex flex-col">
                                        <Label htmlFor="message" className="text-xs uppercase tracking-wider text-muted-foreground">System / User Prompt</Label>
                                        <Textarea
                                            id="message"
                                            placeholder="Enter your prompt here..."
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            className="rounded-none resize-none bg-background/50 font-mono text-sm min-h-[300px] flex-1 p-4"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-border/50">
                                    <Button
                                        onClick={handleSend}
                                        disabled={loading || !message.trim() || !apiKey.trim()}
                                        className="w-full rounded-none h-12 text-base font-medium transition-all hover:translate-y-[-2px]"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Processing Request...
                                            </>
                                        ) : (
                                            <>
                                                Run Request
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TechnicalBorder>
                    </div>

                    {/* Output Side */}
                    <div className="lg:col-span-7 space-y-6">
                        <TechnicalBorder className="h-full">
                            <div className="p-6 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="h-5 w-5 text-primary" />
                                        <h2 className="text-lg font-semibold">Model Response</h2>
                                    </div>
                                    {latency !== null && (
                                        <Badge variant="outline" className="font-mono">
                                            {latency}ms
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex-1 relative min-h-[400px] bg-muted/20 border border-border/50 p-6 font-mono text-sm leading-relaxed overflow-auto">
                                    {loading ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p>Generating response...</p>
                                        </div>
                                    ) : response ? (
                                        <div className="whitespace-pre-wrap">{response}</div>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
                                            <Terminal className="h-12 w-12 mb-4 opacity-20" />
                                            <p>Ready to process</p>
                                        </div>
                                    )}
                                </div>

                                {/* Metrics Footer */}
                                {(cost !== null || tokens !== null) && (
                                    <div className="mt-6 grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-muted/30 border border-border/50">
                                            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Estimated Cost</p>
                                            <p className="text-xl font-mono font-semibold text-primary">
                                                ${cost?.toFixed(5)}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-muted/30 border border-border/50">
                                            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Input Tokens</p>
                                            <p className="text-xl font-mono font-semibold">
                                                {tokens?.prompt.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-muted/30 border border-border/50">
                                            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Output Tokens</p>
                                            <p className="text-xl font-mono font-semibold">
                                                {tokens?.completion.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TechnicalBorder>
                    </div>
                </div>

                {/* Example Prompts */}
                <TechnicalBorder>
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-semibold">Quick Start Prompts</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Quantum Computing", prompt: "Explain quantum computing in simple terms" },
                                { label: "Code Haiku", prompt: "Write a haiku about coding" },
                                { label: "Serverless Benefits", prompt: "What are the benefits of serverless architecture?" },
                                { label: "Spanish Translation", prompt: "Translate 'Hello, how are you?' to Spanish" }
                            ].map((item) => (
                                <Button
                                    key={item.label}
                                    variant="outline"
                                    className="h-auto py-4 px-4 justify-start text-left whitespace-normal rounded-none border-dashed hover:border-solid hover:border-primary/50 hover:bg-primary/5 transition-all"
                                    onClick={() => setMessage(item.prompt)}
                                >
                                    <div>
                                        <div className="font-semibold mb-1">{item.label}</div>
                                        <div className="text-xs text-muted-foreground line-clamp-1">{item.prompt}</div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </div>
                </TechnicalBorder>
            </div>
        </div>
    );
}
