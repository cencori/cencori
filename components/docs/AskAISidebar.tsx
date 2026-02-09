"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X, Send, ThumbsUp, ThumbsDown, Copy, RotateCcw, StopCircle, Sparkles, MessageCircle, Plus, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

interface AskAISidebarProps {
    open: boolean;
    onClose: () => void;
}

const suggestedQuestions = [
    "What is Cencori?",
    "How do I get started?",
    "What is the AI Gateway?",
    "How does memory/RAG work?",
    "How do I set up PII detection?",
];

// Simple syntax highlighter
function highlightCode(code: string, lang: string) {
    if (!code) return code;

    // Basic tokens for JS/TS/Python/Go
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|class|processed|interface|type|public|private|protected|try|catch|finally|def|class|return|in|is|not|and|or|print)\b/g;
    const strings = /("[^"]*"|'[^']*'|`[^`]*`)/g;
    const numbers = /\b\d+\b/g;
    const comments = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g;
    const functions = /\b([a-zA-Z_]\w*)(?=\()/g;
    const brackets = /([{}[\],])/g;

    // We need to tokenize and preserve order. 
    // A simple way is to replace with unique placeholders or try to match iteratively.
    // Given the complexity of full parsing, let's use a simpler approach: splitting by tokens?
    // No, let's use a simple replace sequence with a class-based span, but we must differ safe replacements.
    // Actually, splitting by all regexes at once is hard.

    // Minimal tokenizer with light/dark mode support
    const tokenizers = [
        { type: "comment", regex: comments, color: "text-slate-500 dark:text-slate-400" },
        { type: "string", regex: strings, color: "text-green-600 dark:text-green-400" },
        { type: "keyword", regex: keywords, color: "text-purple-600 dark:text-purple-400" },
        { type: "function", regex: functions, color: "text-blue-600 dark:text-blue-400" },
        { type: "number", regex: numbers, color: "text-orange-600 dark:text-orange-400" },
        { type: "bracket", regex: brackets, color: "text-yellow-600 dark:text-yellow-500" },
    ];

    let segments: { text: string; color?: string }[] = [{ text: code }];

    for (const token of tokenizers) {
        const newSegments: { text: string; color?: string }[] = [];
        for (const segment of segments) {
            if (segment.color) {
                newSegments.push(segment);
                continue;
            }

            let lastIndex = 0;
            let match;
            // Reset regex state
            token.regex.lastIndex = 0;
            // We need to loop manually because we might match multiples
            // But strict regex global replace is easier if we can operate on text.
            // Since we can't easily overlapping, we do stages.

            const text = segment.text;
            const matches = Array.from(text.matchAll(token.regex));

            if (matches.length === 0) {
                newSegments.push(segment);
                continue;
            }

            for (const m of matches) {
                if (m.index! > lastIndex) {
                    newSegments.push({ text: text.slice(lastIndex, m.index!) });
                }
                newSegments.push({ text: m[0], color: token.color });
                lastIndex = m.index! + m[0].length;
            }
            if (lastIndex < text.length) {
                newSegments.push({ text: text.slice(lastIndex) });
            }
        }
        segments = newSegments;
    }

    return segments.map((s, i) => (
        <span key={i} className={s.color || "text-foreground"}>{s.text}</span>
    ));
}

function renderMarkdown(text: string) {
    // Process the text line by line for better control
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent = "";
    let codeLanguage = "";
    let listItems: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let listKey = 0;

    const flushList = () => {
        if (listItems.length > 0 && listType) {
            const ListComponent = listType === "ol" ? "ol" : "ul";
            elements.push(
                <ListComponent key={`list-${elements.length}-${listKey++}`} className={listType === "ol" ? "list-decimal ml-4 my-2" : "list-disc ml-4 my-2"}>
                    {listItems.map((item, i) => (
                        <li key={i} className="text-sm text-foreground/90">{processInline(item)}</li>
                    ))}
                </ListComponent>
            );
            listItems = [];
            listType = null;
        }
    };

    const processInline = (line: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let remaining = line;
        let key = 0;

        while (remaining.length > 0) {
            const codeMatch = remaining.match(/`([^`]+)`/);
            const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
            const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

            const matches = [
                codeMatch ? { type: "code", match: codeMatch, index: codeMatch.index! } : null,
                boldMatch ? { type: "bold", match: boldMatch, index: boldMatch.index! } : null,
                linkMatch ? { type: "link", match: linkMatch, index: linkMatch.index! } : null,
            ].filter(Boolean).sort((a, b) => a!.index - b!.index);

            if (matches.length === 0) {
                parts.push(remaining);
                break;
            }

            const first = matches[0]!;
            if (first.index > 0) {
                parts.push(remaining.slice(0, first.index));
            }

            if (first.type === "code") {
                parts.push(<code key={`inline-${key++}`} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary font-medium">{first.match![1]}</code>);
                remaining = remaining.slice(first.index + first.match![0].length);
            } else if (first.type === "bold") {
                parts.push(<strong key={`bold-${key++}`} className="font-semibold">{first.match![1]}</strong>);
                remaining = remaining.slice(first.index + first.match![0].length);
            } else if (first.type === "link") {
                parts.push(<a key={`link-${key++}`} href={first.match![2]} className="text-primary hover:underline font-medium" target="_blank" rel="noopener">{first.match![1]}</a>);
                remaining = remaining.slice(first.index + first.match![0].length);
            }
        }

        return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith("```")) {
            if (!inCodeBlock) {
                flushList();
                inCodeBlock = true;
                codeLanguage = line.slice(3).trim();
                codeContent = "";
            } else {
                elements.push(
                    <div key={`code-${elements.length}`} className="my-3 rounded-lg overflow-hidden border border-border/50 bg-muted/30 dark:bg-[#1e1e1e]">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 dark:bg-white/5 border-b border-border/50 dark:border-white/5">
                            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{codeLanguage || "code"}</span>
                            <button onClick={() => navigator.clipboard.writeText(codeContent)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <Copy className="h-3 w-3" />
                            </button>
                        </div>
                        <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
                            <code>{highlightCode(codeContent.trim(), codeLanguage)}</code>
                        </pre>
                    </div>
                );
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent += (codeContent ? "\n" : "") + line;
            continue;
        }

        const olMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (olMatch) {
            if (listType !== "ol") flushList();
            listType = "ol";
            listItems.push(olMatch[2]);
            continue;
        }

        const ulMatch = line.match(/^[-*]\s+(.+)/);
        if (ulMatch) {
            if (listType !== "ul") flushList();
            listType = "ul";
            listItems.push(ulMatch[1]);
            continue;
        }

        flushList();

        if (!line.trim()) {
            elements.push(<div key={`spacer-${elements.length}`} className="h-2" />);
            continue;
        }

        if (line.startsWith("### ")) {
            elements.push(<h4 key={`h4-${elements.length}`} className="font-semibold text-sm mt-4 mb-2">{line.slice(4)}</h4>);
            continue;
        }
        if (line.startsWith("## ")) {
            elements.push(<h3 key={`h3-${elements.length}`} className="font-semibold text-base mt-5 mb-2">{line.slice(3)}</h3>);
            continue;
        }
        if (line.startsWith("# ")) {
            elements.push(<h2 key={`h2-${elements.length}`} className="font-bold text-lg mt-6 mb-3">{line.slice(2)}</h2>);
            continue;
        }

        elements.push(<p key={`p-${elements.length}`} className="text-sm text-foreground/90 leading-relaxed">{processInline(line)}</p>);
    }

    flushList();

    return elements;
}

export function AskAISidebar({ open, onClose }: AskAISidebarProps) {
    const pathname = usePathname();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingContent]);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: content.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        setStreamingContent("");

        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch("/api/docs/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    currentPage: pathname,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error("Failed to get response");

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let fullContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullContent += parsed.content;
                                setStreamingContent(fullContent);
                            }
                        } catch {
                        }
                    }
                }
            }

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: fullContent,
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingContent("");
        } catch (error) {
            if ((error as Error).name !== "AbortError") {
                console.error("Chat error:", error);
                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again.",
                };
                setMessages((prev) => [...prev, errorMessage]);
            }
            setStreamingContent("");
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [messages, pathname, isLoading]);

    const stopGeneration = () => {
        abortControllerRef.current?.abort();
        if (streamingContent) {
            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: streamingContent,
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingContent("");
        }
        setIsLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const copyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const regenerate = () => {
        if (messages.length >= 2) {
            const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
            if (lastUserMessage) {
                // Remove last assistant message
                setMessages((prev) => prev.slice(0, -1));
                sendMessage(lastUserMessage.content);
            }
        }
    };

    const clearChat = () => {
        setMessages([]);
        setStreamingContent("");
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed top-0 right-0 bottom-0 w-full md:w-[400px] bg-background border-l-0 md:border-l border-border/40 flex flex-col z-[60]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-border/40">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">Ask AI</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {messages.length > 0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 transition-colors" onClick={clearChat}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                </svg>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Clear chat</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                </svg>
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                        {messages.length === 0 && !streamingContent && (
                            <div className="space-y-4 mt-auto">
                                <div className="space-y-2">
                                    {suggestedQuestions.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(q)}
                                            className="w-full text-left px-3 py-2 rounded-lg border border-border/40 text-sm hover:bg-muted/50 transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    Tip: Press Enter to send your message
                                </p>
                            </div>
                        )}

                        {messages.map((message) => (
                            <div key={message.id} className={`${message.role === "user" ? "flex justify-end" : ""}`}>
                                {message.role === "user" ? (
                                    <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2">
                                        <p className="text-sm">{message.content}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="mb-2">
                                            <ThinkingIndicator finished={true} />
                                        </div>
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            {renderMarkdown(message.content)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Helpful">
                                                <ThumbsUp className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Not helpful">
                                                <ThumbsDown className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyMessage(message.content)} title="Copy">
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={regenerate} title="Regenerate">
                                                <RotateCcw className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && !streamingContent && (
                            <div className="flex justify-start mb-4">
                                <ThinkingIndicator />
                            </div>
                        )}

                        {streamingContent && (
                            <div className="space-y-2">
                                <div className="mb-2">
                                    <ThinkingIndicator finished={!isLoading} />
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    {renderMarkdown(streamingContent)}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-border/60 bg-background/50 backdrop-blur-sm">
                        <div className="relative flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-2.5 pl-4 py-2 transition-all hover:bg-muted/30 hover:border-border/80 focus-within:border-white/20 focus-within:bg-muted/30">

                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask a question..."
                                rows={1}
                                className="flex-1 resize-none bg-transparent py-2 text-sm placeholder:text-muted-foreground focus:outline-none max-h-32"
                                disabled={isLoading}
                                style={{ minHeight: "24px" }}
                            />
                            <div className="flex-shrink-0">
                                {isLoading ? (
                                    <Button
                                        size="icon"
                                        className="h-10 w-10 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all"
                                        onClick={stopGeneration}
                                    >
                                        <StopCircle className="h-4 w-4 fill-current" />
                                    </Button>
                                ) : (
                                    <Button
                                        size="icon"
                                        className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={() => sendMessage(input)}
                                        disabled={!input.trim()}
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
