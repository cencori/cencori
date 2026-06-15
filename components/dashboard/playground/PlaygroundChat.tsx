"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowUp,
    Copy,
    RotateCcw,
    StopCircle,
    Trash2,
    Search,
    Check,
    ChevronDown,
    Brain,
} from "lucide-react";
import {
    OpenAI, Anthropic, Google, Mistral, Cohere,
    Perplexity, OpenRouter, Groq, XAI, Together,
    Meta, HuggingFace, Qwen, DeepSeek,
    Minimax, Baidu,
} from "@lobehub/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { ThinkingIndicator } from "@/components/docs/ThinkingIndicator";
import { UpgradeDialog } from "@/components/billing/UpgradeDialog";
import { SUPPORTED_PROVIDERS } from "@/lib/providers/config";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    modelId?: string;
    metrics?: {
        costUsd: number;
        latencyMs: number;
        promptTokens: number;
        completionTokens: number;
    };
    isStreaming?: boolean;
}

interface PlaygroundChatProps {
    orgSlug: string;
    projectSlug: string;
    environment: string;
    projectId: string;
    orgId: string;
    subscriptionTier: string;
}

// ─── Flat model parsing from catalog ─────────────────────────────────────────
interface FlatModel {
    id: string;
    name: string;
    providerId: string;
    providerName: string;
    free: boolean;
    contextWindow: number;
    type: string[];
}

const allCatalogModels: FlatModel[] = SUPPORTED_PROVIDERS.flatMap((provider) =>
    provider.models.map((model) => ({
        id: model.id,
        name: model.name,
        providerId: provider.id,
        providerName: provider.name,
        free: Boolean(model.free),
        contextWindow: model.contextWindow,
        type: Array.isArray(model.type) ? model.type : [model.type],
    }))
);

// Filter out image/embedding models for standard chat playground
const chatCatalogModels = allCatalogModels.filter(
    (m) => !m.type.includes("image") && !m.type.includes("embedding")
);

// ─── Provider icon mapping ──────────────────────────────────────────────────
const PROVIDER_ICONS: Record<string, (size: number) => React.ReactNode> = {
    openai: (s) => <OpenAI size={s} />,
    anthropic: (s) => <Anthropic size={s} />,
    google: (s) => <Google.Color size={s} />,
    mistral: (s) => <Mistral.Color size={s} />,
    cohere: (s) => <Cohere.Color size={s} />,
    perplexity: (s) => <Perplexity.Color size={s} />,
    groq: (s) => <Groq size={s} />,
    together: (s) => <Together.Color size={s} />,
    openrouter: (s) => <OpenRouter size={s} />,
    xai: (s) => <XAI size={s} />,
    meta: (s) => <Meta.Avatar size={s} />,
    huggingface: (s) => <HuggingFace.Color size={s} />,
    qwen: (s) => <Qwen.Avatar size={s} />,
    deepseek: (s) => <DeepSeek.Color size={s} />,
    minimax: (s) => <Minimax.Avatar size={s} />,
    baidu: (s) => <Baidu.Color size={s} />,
};

function ProviderIcon({ providerId, size = 14 }: { providerId: string; size?: number }) {
    const Icon = PROVIDER_ICONS[providerId as keyof typeof PROVIDER_ICONS];
    if (!Icon) {
        return (
            <div
                className="bg-muted rounded-sm flex items-center justify-center shrink-0"
                style={{ width: size, height: size }}
            >
                <Brain className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
        );
    }
    return <div className="shrink-0 flex items-center justify-center">{Icon(size)}</div>;
}

const SUGGESTED_PROMPTS = [
    "Explain quantum computing in simple terms",
    "Write a haiku about coding",
    "What are the benefits of serverless architecture?",
    "Translate 'Hello, how are you?' to Spanish",
];

export function PlaygroundChat({
    orgSlug,
    projectSlug,
    environment,
    projectId,
    orgId,
    subscriptionTier,
}: PlaygroundChatProps) {
    const router = useRouter();
    const [selectedModels, setSelectedModels] = useState<string[]>(["gpt-4o"]);
    const [activeSelectorIndex, setActiveSelectorIndex] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Model Selector dropdown states
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [modelSearchQuery, setModelSearchQuery] = useState("");
    const [modelActiveTab, setModelActiveTab] = useState<"all" | "free" | "pro">("all");

    // Upgrade Dialog state
    const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

    const abortControllersRef = useRef<AbortController[] | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const modelSelectorRef = useRef<HTMLDivElement>(null);

    const canSend = !isLoading;

    // Scroll to bottom when messages update
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Close model selector on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                modelSelectorRef.current &&
                !modelSelectorRef.current.contains(event.target as Node)
            ) {
                setIsModelSelectorOpen(false);
                setActiveSelectorIndex(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const sendMessage = useCallback(
        async (content: string, historyOverride?: Message[]) => {
            const trimmed = content.trim();
            if (!trimmed || isLoading) return;

            // Feature gating check
            const isFreeTier = !subscriptionTier || subscriptionTier === "free";
            const selectedModelObjs = selectedModels
                .map((id) => chatCatalogModels.find((m) => m.id === id))
                .filter(Boolean);
            const hasProModelSelected = selectedModelObjs.some((m) => !m?.free);

            if (hasProModelSelected && isFreeTier) {
                setIsUpgradeDialogOpen(true);
                return;
            }

            const baseMessages = historyOverride ?? messages;
            const userMessage: Message = {
                id: crypto.randomUUID(),
                role: "user",
                content: trimmed,
            };

            const isRegeneration = Boolean(historyOverride);

            // Create placeholders for each selected model
            const placeholders = selectedModels.map((mId) => ({
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: "",
                modelId: mId,
                isStreaming: true,
            }));

            if (!isRegeneration) {
                setMessages((prev) => [...prev, userMessage, ...placeholders]);
            } else {
                setMessages((prev) => [...prev, ...placeholders]);
            }

            setInput("");
            if (inputRef.current) {
                inputRef.current.style.height = "auto";
            }
            setIsLoading(true);

            const abortControllers: AbortController[] = [];

            // Compile history helper for a specific model
            const getHistoryForModel = (mId: string) => {
                const history = isRegeneration ? baseMessages : [...baseMessages, userMessage];
                return history
                    .filter((msg) => msg.role === "user" || msg.modelId === mId || !msg.modelId)
                    .map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                    }));
            };

            const fetchPromises = placeholders.map(async (placeholder) => {
                const controller = new AbortController();
                abortControllers.push(controller);
                const modelId = placeholder.modelId;
                const conversation = getHistoryForModel(modelId);
                const startTime = Date.now();
                let fullContent = "";
                let usage = { prompt_tokens: 0, completion_tokens: 0 };
                let costUsd = 0;

                try {
                    const response = await fetch("/api/ai/chat", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Playground-Project-Id": projectId,
                            "X-Playground-Environment": environment,
                        },
                        body: JSON.stringify({
                            model: modelId,
                            messages: conversation,
                            stream: true,
                        }),
                        signal: controller.signal,
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(
                            typeof errorData.error === "string"
                                ? errorData.error
                                : "Failed to get response"
                        );
                    }

                    const reader = response.body?.getReader();
                    if (!reader) throw new Error("No response body");

                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value);
                        const lines = chunk.split("\n");

                        for (const line of lines) {
                            if (!line.startsWith("data: ")) continue;

                            const data = line.slice(6).trim();
                            if (data === "[DONE]") continue;

                            try {
                                const parsed = JSON.parse(data) as {
                                    delta?: string;
                                    content?: string;
                                    error?: string;
                                    usage?: { prompt_tokens?: number; completion_tokens?: number };
                                    cost_usd?: number;
                                };

                                if (parsed.error) {
                                    throw new Error(parsed.error);
                                }

                                const delta = parsed.delta ?? parsed.content ?? "";
                                if (delta) {
                                    fullContent += delta;
                                    setMessages((prev) =>
                                        prev.map((msg) =>
                                            msg.id === placeholder.id
                                                ? { ...msg, content: fullContent }
                                                : msg
                                        )
                                    );
                                }

                                if (parsed.usage) {
                                    usage = {
                                        prompt_tokens: parsed.usage.prompt_tokens ?? usage.prompt_tokens,
                                        completion_tokens:
                                            parsed.usage.completion_tokens ?? usage.completion_tokens,
                                    };
                                }

                                if (typeof parsed.cost_usd === "number") {
                                    costUsd = parsed.cost_usd;
                                }
                            } catch (error) {
                                if (
                                    error instanceof Error &&
                                    error.message !== "Unexpected end of JSON input"
                                ) {
                                    throw error;
                                }
                            }
                        }
                    }

                    const latencyMs = Date.now() - startTime;
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === placeholder.id
                                ? {
                                      ...msg,
                                      content: fullContent || "No response",
                                      isStreaming: false,
                                      metrics: {
                                          costUsd,
                                          latencyMs,
                                          promptTokens: usage.prompt_tokens,
                                          completionTokens: usage.completion_tokens,
                                      },
                                  }
                                : msg
                        )
                    );
                } catch (error) {
                    const latencyMs = Date.now() - startTime;
                    const errMessage = error instanceof Error ? error.message : "Error occurred";

                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id === placeholder.id) {
                                if ((error as Error).name === "AbortError") {
                                    return {
                                        ...msg,
                                        content: fullContent || "Generation stopped",
                                        isStreaming: false,
                                        metrics: {
                                            costUsd: 0,
                                            latencyMs,
                                            promptTokens: 0,
                                            completionTokens: 0,
                                        },
                                    };
                                }
                                return {
                                    ...msg,
                                    content: `Sorry, something went wrong: ${errMessage}`,
                                    isStreaming: false,
                                    metrics: {
                                        costUsd: 0,
                                        latencyMs,
                                        promptTokens: 0,
                                        completionTokens: 0,
                                    },
                                };
                            }
                            return msg;
                        })
                    );
                }
            });

            abortControllersRef.current = abortControllers;
            await Promise.all(fetchPromises);
            setIsLoading(false);
            abortControllersRef.current = null;
        },
        [isLoading, messages, selectedModels, projectId, environment, subscriptionTier, orgId, orgSlug]
    );

    const stopGeneration = () => {
        abortControllersRef.current?.forEach((ctrl) => ctrl.abort());
        setIsLoading(false);
    };

    const clearChat = () => {
        if (isLoading) stopGeneration();
        setMessages([]);
    };

    const regenerate = () => {
        const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
        if (lastUserIndex === -1) return;

        const trimmedHistory = messages.slice(0, lastUserIndex + 1);
        const lastUserMessage = messages[lastUserIndex];

        setMessages(trimmedHistory);
        void sendMessage(lastUserMessage.content, messages.slice(0, lastUserIndex));
    };

    const copyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success("Message copied");
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void sendMessage(input);
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(event.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    };

    // Filter models based on search and selected tab
    const filteredModels = chatCatalogModels.filter((m) => {
        const matchesSearch =
            m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
            m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
            m.providerName.toLowerCase().includes(modelSearchQuery.toLowerCase());

        const matchesTab =
            modelActiveTab === "all" ||
            (modelActiveTab === "free" && m.free) ||
            (modelActiveTab === "pro" && !m.free);

        return matchesSearch && matchesTab;
    });

    // The active model is the one whose selector popover is open (or first slot)
    const activeSlotIndex = activeSelectorIndex ?? 0;
    const activeModelObj = chatCatalogModels.find(
        (m) => m.id === selectedModels[activeSlotIndex]
    );

    const handleAddModelSlot = () => {
        if (selectedModels.length >= 3) return;
        const available = chatCatalogModels.find((m) => !selectedModels.includes(m.id))?.id || selectedModels[0];
        const nextIndex = selectedModels.length;
        setSelectedModels((prev) => [...prev, available]);
        setActiveSelectorIndex(nextIndex);
        setIsModelSelectorOpen(true);
    };

    const handleRemoveModel = (index: number) => {
        if (selectedModels.length <= 1) return;
        setSelectedModels((prev) => prev.filter((_, i) => i !== index));
        if (activeSelectorIndex === index) {
            setIsModelSelectorOpen(false);
            setActiveSelectorIndex(null);
        } else if (activeSelectorIndex !== null && activeSelectorIndex > index) {
            setActiveSelectorIndex(activeSelectorIndex - 1);
        }
    };

    const handleSelectModelForSlot = (modelId: string) => {
        const idx = activeSelectorIndex ?? 0;
        setSelectedModels((prev) => {
            const next = [...prev];
            next[idx] = modelId;
            return next;
        });
        setIsModelSelectorOpen(false);
        setActiveSelectorIndex(null);
    };

    // Helpers for rendering
    const getModelObj = (modelId: string) => chatCatalogModels.find((m) => m.id === modelId);
    const isMultiModel = selectedModels.length > 1;

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Chat Body */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                    ref={messagesContainerRef}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4"
                >
                    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-start gap-6">
                        {messages.length === 0 && !isLoading && (
                            <div className="my-auto flex flex-col gap-3 pb-4 max-w-xl mx-auto w-full px-4">
                                <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1 text-center">
                                    Suggested Prompts
                                </h3>
                                {SUGGESTED_PROMPTS.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => void sendMessage(prompt)}
                                        disabled={!canSend}
                                        className={cn(
                                            "w-full rounded-xl px-4 py-3 text-left text-xs text-muted-foreground border border-border/20 bg-muted/5 transition-all hover:bg-muted/40 hover:text-foreground",
                                            !canSend && "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        )}

                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    "flex flex-col px-4",
                                    message.role === "user" ? "items-end" : "items-start"
                                )}
                            >
                                {message.role === "user" ? (
                                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-primary-foreground shadow-sm">
                                        <p className="text-xs font-medium leading-relaxed">{message.content}</p>
                                    </div>
                                ) : (
                                    <div className="w-full space-y-2">
                                        {/* Model Label Header (shown when multi-model or always for clarity) */}
                                        {message.modelId && (() => {
                                            const mObj = getModelObj(message.modelId);
                                            return (
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <ProviderIcon providerId={mObj?.providerId ?? ""} size={13} />
                                                    <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide">
                                                        {mObj?.name ?? message.modelId}
                                                    </span>
                                                    {mObj && (
                                                        <Badge
                                                            className={cn(
                                                                "h-3.5 px-1 text-[7px] font-bold uppercase scale-90",
                                                                mObj.free
                                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                                    : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                                            )}
                                                        >
                                                            {mObj.free ? "Free" : "Pro"}
                                                        </Badge>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Streaming indicator or content */}
                                        {message.isStreaming && !message.content ? (
                                            <ThinkingIndicator />
                                        ) : (
                                            <>
                                                <ThinkingIndicator finished />
                                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                                    <MarkdownRenderer content={message.content} />
                                                </div>
                                            </>
                                        )}

                                        {/* Metrics + action buttons (only show when not streaming) */}
                                        {!message.isStreaming && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                {message.metrics && (
                                                    <div className="mr-2 flex flex-wrap items-center gap-1.5">
                                                        <Badge
                                                            variant="outline"
                                                            className="h-5 font-mono text-[9px] text-muted-foreground border-border/30 bg-muted/5 px-1.5"
                                                        >
                                                            {message.metrics.latencyMs}ms
                                                        </Badge>
                                                        {message.metrics.costUsd > 0 && (
                                                            <Badge
                                                                variant="outline"
                                                                className="h-5 font-mono text-[9px] text-muted-foreground border-border/30 bg-muted/5 px-1.5"
                                                            >
                                                                ${message.metrics.costUsd.toFixed(5)}
                                                            </Badge>
                                                        )}
                                                        {message.metrics.promptTokens > 0 && (
                                                            <Badge
                                                                variant="outline"
                                                                className="h-5 font-mono text-[9px] text-muted-foreground border-border/30 bg-muted/5 px-1.5"
                                                            >
                                                                {message.metrics.promptTokens.toLocaleString()} in
                                                            </Badge>
                                                        )}
                                                        {message.metrics.completionTokens > 0 && (
                                                            <Badge
                                                                variant="outline"
                                                                className="h-5 font-mono text-[9px] text-muted-foreground border-border/30 bg-muted/5 px-1.5"
                                                            >
                                                                {message.metrics.completionTokens.toLocaleString()} out
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                                                    onClick={() => copyMessage(message.content)}
                                                    title="Copy to clipboard"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                                                    onClick={regenerate}
                                                    title="Regenerate response"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Redesigned Glassmorphic Input Area */}
                <div className="shrink-0 bg-transparent pt-4 pb-16 px-4">
                    <div className="mx-auto w-full max-w-3xl">
                        <div className="relative flex flex-col rounded-2xl border border-border/40 bg-muted/10 backdrop-blur-md p-3 transition-all hover:border-border/60 hover:bg-muted/20 focus-within:border-primary/45 focus-within:ring-1 focus-within:ring-primary/20">
                            {/* Textarea */}
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask a question..."
                                rows={2}
                                disabled={isLoading}
                                className="max-h-40 min-h-[48px] w-full resize-none bg-transparent py-1.5 text-base md:text-xs placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
                            />

                            {/* Input Area Controls Footer */}
                            <div className="flex items-center justify-between pt-2.5 mt-2 select-none">
                                {/* Model Chips + Selector */}
                                <div className="relative flex items-center gap-1.5 flex-wrap" ref={modelSelectorRef}>
                                    {/* Model Slot Chips */}
                                    {selectedModels.map((mId, index) => {
                                        const mObj = getModelObj(mId);
                                        const isActiveSlot = activeSelectorIndex === index && isModelSelectorOpen;
                                        return (
                                            <div key={`slot-${index}`} className="relative flex items-center gap-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveSelectorIndex(index);
                                                        setIsModelSelectorOpen(true);
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer",
                                                        isActiveSlot
                                                            ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                                                            : "bg-card/60 hover:bg-card/85 text-foreground"
                                                    )}
                                                >
                                                    <ProviderIcon providerId={mObj?.providerId ?? "openai"} size={13} />
                                                    <span className="max-w-[100px] truncate">{mObj?.name ?? mId}</span>
                                                    {mObj && (
                                                        <Badge
                                                            className={cn(
                                                                "h-4 px-1 text-[8px] font-bold uppercase",
                                                                mObj.free
                                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                                    : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                                            )}
                                                        >
                                                            {mObj.free ? "Free" : "Pro"}
                                                        </Badge>
                                                    )}
                                                </button>
                                                {/* Remove button (only if more than 1 model) */}
                                                {selectedModels.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveModel(index);
                                                        }}
                                                        className="ml-0.5 p-0.5 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
                                                        title="Remove model"
                                                    >
                                                        <HugeiconsIcon icon={Cancel01Icon} size={12} />
                                                    </button>
                                                )}

                                                {/* Model Selector Popover */}
                                                {isActiveSlot && (
                                                    <div className="absolute z-50 bottom-full mb-2.5 left-0 w-80 rounded-2xl border border-border/40 bg-popover shadow-2xl p-2.5 flex flex-col max-h-[350px] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                                                        {/* Search */}
                                                        <div className="relative mb-2 shrink-0">
                                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search models..."
                                                                value={modelSearchQuery}
                                                                onChange={(e) => setModelSearchQuery(e.target.value)}
                                                                className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/30 bg-muted/40 text-base md:text-xs placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                                                            />
                                                        </div>

                                                        {/* Tabs */}
                                                        <div className="flex gap-1 mb-2 bg-muted/40 p-0.5 rounded-lg shrink-0">
                                                            {(["all", "free", "pro"] as const).map((tab) => (
                                                                <button
                                                                    key={tab}
                                                                    type="button"
                                                                    onClick={() => setModelActiveTab(tab)}
                                                                    className={cn(
                                                                        "flex-1 py-1 text-[10px] font-medium rounded-md capitalize transition-all cursor-pointer",
                                                                        modelActiveTab === tab
                                                                            ? "bg-background text-foreground shadow-sm"
                                                                            : "text-muted-foreground hover:text-foreground/80"
                                                                    )}
                                                                >
                                                                    {tab === "all" ? "All" : tab === "free" ? "Free" : "Pro"}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Models List */}
                                                        <div className="overflow-y-auto flex-1 pr-1 space-y-0.5 scrollbar-thin">
                                                            {filteredModels.length === 0 ? (
                                                                <div className="text-center py-6 text-xs text-muted-foreground/50">
                                                                    No models found
                                                                </div>
                                                            ) : (
                                                                filteredModels.map((m) => {
                                                                    const isSelected = selectedModels[activeSlotIndex] === m.id;
                                                                    return (
                                                                        <button
                                                                            key={`${m.providerId}:${m.id}`}
                                                                            type="button"
                                                                            onClick={() => handleSelectModelForSlot(m.id)}
                                                                            className={cn(
                                                                                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all hover:bg-muted/50 cursor-pointer",
                                                                                isSelected && "bg-muted text-foreground"
                                                                            )}
                                                                        >
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <div className="shrink-0 w-5 h-5 flex items-center justify-center rounded bg-muted/60">
                                                                                    <ProviderIcon providerId={m.providerId} size={12} />
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[11px] font-medium text-foreground truncate">
                                                                                            {m.name}
                                                                                        </span>
                                                                                        <Badge
                                                                                            className={cn(
                                                                                                "h-3.5 px-1 text-[7px] font-bold uppercase shrink-0 scale-90",
                                                                                                m.free
                                                                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                                                                    : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                                                                            )}
                                                                                        >
                                                                                            {m.free ? "Free" : "Pro"}
                                                                                        </Badge>
                                                                                    </div>
                                                                                    <span className="text-[9px] text-muted-foreground/60 truncate block leading-normal">
                                                                                        {m.providerName} • {m.contextWindow.toLocaleString()} ctx
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            {isSelected && (
                                                                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Add Model (+) Button */}
                                    {selectedModels.length < 3 && (
                                        <button
                                            type="button"
                                            onClick={handleAddModelSlot}
                                            className="flex items-center justify-center h-7 w-7 rounded-xl bg-card/40 hover:bg-card/70 text-muted-foreground/60 hover:text-foreground transition-all cursor-pointer border border-dashed border-border/30 hover:border-border/50"
                                            title="Compare with another model"
                                        >
                                            <HugeiconsIcon icon={PlusSignIcon} size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Controls: Clear Chat + Send */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {messages.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground transition-all cursor-pointer"
                                            onClick={clearChat}
                                            aria-label="Clear chat"
                                            title="Clear chat"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {isLoading ? (
                                        <Button
                                            type="button"
                                            size="icon"
                                            className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer"
                                            onClick={stopGeneration}
                                            aria-label="Stop generation"
                                        >
                                            <StopCircle className="h-3.5 w-3.5 fill-current" />
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="icon"
                                            className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40 transition-all cursor-pointer"
                                            onClick={() => void sendMessage(input)}
                                            disabled={!input.trim()}
                                            aria-label="Send message"
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <UpgradeDialog
                open={isUpgradeDialogOpen}
                onOpenChange={setIsUpgradeDialogOpen}
                orgId={orgId}
                orgSlug={orgSlug}
                reason="Upgrade to Pro to test premium models directly in the playground."
            />
        </div>
    );
}
