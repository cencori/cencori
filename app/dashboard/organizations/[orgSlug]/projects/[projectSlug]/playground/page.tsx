"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Play, Zap, AlertCircle, Key } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
                    </div>
                    <Badge variant={environment === "production" ? "default" : "secondary"}>
                        {environment === "production" ? "Production" : "Development"}
                    </Badge>
                </div>
                <p className="text-muted-foreground mt-2">
                    Test different AI models and compare responses in real-time
                </p>
            </div>

            <Separator className="mb-6" />

            {/* API Key Input Section */}
            {!checkingKeys && !hasKeys && (
                <Alert className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        No {envName} API keys found. {" "}
                        <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/api-keys`)}
                        >
                            Create one first
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <Card className="rounded-none border-2 mb-6">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Enter Your API Key
                    </CardTitle>
                    <CardDescription>
                        For security, API keys are hashed and not stored in plaintext. Paste your {envName.toLowerCase()} key here to use the playground.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            type={apiKeyVisible ? "text" : "password"}
                            placeholder={`cen_${environment === "test" ? "test_" : ""}...`}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="rounded-none font-mono text-sm"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setApiKeyVisible(!apiKeyVisible)}
                            className="rounded-none"
                        >
                            {apiKeyVisible ? "Hide" : "Show"}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Your API key is never stored in the browser. It's only used for this session.
                    </p>
                </CardContent>
            </Card>

            {/* Main Playground */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Side */}
                <Card className="rounded-none border-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Input</CardTitle>
                        <CardDescription>Configure your request</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Model Selector */}
                        <div className="space-y-2">
                            <Label htmlFor="model">Model</Label>
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger id="model" className="rounded-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {MODELS.map((model) => (
                                        <SelectItem key={model.value} value={model.value} className="rounded-none">
                                            <div className="flex items-center gap-2">
                                                <span>{model.label}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {model.provider}
                                                </Badge>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Message Input */}
                        <div className="space-y-2">
                            <Label htmlFor="message">Message</Label>
                            <Textarea
                                id="message"
                                placeholder="Ask anything..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={8}
                                className="rounded-none resize-none"
                            />
                        </div>

                        {/* Send Button */}
                        <Button
                            onClick={handleSend}
                            disabled={loading || !message.trim() || !apiKey.trim()}
                            className="w-full rounded-none"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Send Request
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Output Side */}
                <Card className="rounded-none border-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Response</CardTitle>
                        <CardDescription>AI model output and metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Response */}
                        <div className="space-y-2">
                            <Label>Response</Label>
                            <div className="min-h-[200px] p-4 border rounded-none bg-muted/30 whitespace-pre-wrap">
                                {loading ? (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Waiting for response...</span>
                                    </div>
                                ) : response ? (
                                    <p className="text-sm">{response}</p>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">
                                        Response will appear here...
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Metrics */}
                        {(cost !== null || latency !== null || tokens !== null) && (
                            <div className="space-y-2">
                                <Label>Metrics</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {cost !== null && (
                                        <div className="p-3 border rounded-none bg-background">
                                            <p className="text-xs text-muted-foreground">Cost</p>
                                            <p className="text-lg font-semibold">${cost.toFixed(4)}</p>
                                        </div>
                                    )}
                                    {latency !== null && (
                                        <div className="p-3 border rounded-none bg-background">
                                            <p className="text-xs text-muted-foreground">Latency</p>
                                            <p className="text-lg font-semibold">{latency}ms</p>
                                        </div>
                                    )}
                                    {tokens !== null && (
                                        <div className="p-3 border rounded-none bg-background">
                                            <p className="text-xs text-muted-foreground">Tokens</p>
                                            <p className="text-lg font-semibold">
                                                {tokens.prompt + tokens.completion}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Example Prompts */}
            <Card className="rounded-none border-2 mt-6">
                <CardHeader>
                    <CardTitle className="text-lg">Example Prompts</CardTitle>
                    <CardDescription>Try these to get started</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none"
                            onClick={() => setMessage("Explain quantum computing in simple terms")}
                        >
                            Explain quantum computing
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none"
                            onClick={() => setMessage("Write a haiku about coding")}
                        >
                            Write a haiku
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none"
                            onClick={() => setMessage("What are the benefits of serverless architecture?")}
                        >
                            Serverless benefits
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none"
                            onClick={() => setMessage("Translate 'Hello, how are you?' to Spanish")}
                        >
                            Translation example
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
