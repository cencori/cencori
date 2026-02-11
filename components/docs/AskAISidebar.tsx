"use client";

import Image from "next/image";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X, Send, ThumbsUp, ThumbsDown, Copy, RotateCcw, StopCircle, MessageCircle, Plus, ArrowUp, File, Share } from "lucide-react";
import { useDocsContext } from "./DocsContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachedPage?: { title: string; slug: string } | null;
}

interface AskAISidebarProps {
    open: boolean;
    onClose: () => void;
}

const CencoriLogo = ({ className }: { className?: string }) => (
    <div className={`relative ${className}`} style={{ width: '1em', height: '1em' }}>
        <Image
            src="/logo black.svg"
            alt="Cencori Logo"
            fill
            className="dark:hidden object-contain"
        />
        <Image
            src="/logo white.svg"
            alt="Cencori Logo"
            fill
            className="hidden dark:block object-contain"
        />
    </div>
);

const UserIcon1 = (props: React.ComponentProps<"svg">) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
    </svg>
);

const UserIcon2 = (props: React.ComponentProps<"svg">) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </svg>
);

const UserIcon3 = (props: React.ComponentProps<"svg">) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
    </svg>
);

const UserIcon4 = (props: React.ComponentProps<"svg">) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
);

const suggestedQuestions = [
    { text: "What is Cencori?", icon: CencoriLogo },
    { text: "How do I get started?", icon: UserIcon1 },
    { text: "What is the AI Gateway?", icon: UserIcon2 },
    { text: "How does memory/RAG work?", icon: UserIcon3 },
    { text: "How do I set up PII detection?", icon: UserIcon4 },
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
    const { attachedPage, setAttachedPage, userProfile } = useDocsContext();
    const [messages, setMessages] = useState<Message[]>([]);

    // Use environment variable or default for absolute URLs
    const baseUrl = "https://cencori.com";
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

        // Capture current attachment if any
        const currentAttachment = attachedPage;
        // Clear attachment immediately so it doesn't get sent twice or reused accidentally
        setAttachedPage(null);

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: content.trim(),
            attachedPage: currentAttachment,
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
                    // If we have an attached page, use that as the primary context
                    currentPage: currentAttachment ? `/docs/${currentAttachment.slug}` : pathname,
                    userName: userProfile?.name,
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
    }, [messages, pathname, isLoading, attachedPage, setAttachedPage]);

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
        setAttachedPage(null);
    };

    const getConversationText = () => {
        return messages.map(m => {
            const role = m.role === "user" ? "User" : "AI";
            return `${role}: ${m.content}`;
        }).join("\n\n");
    };

    const copyConversation = async () => {
        const text = getConversationText();
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            toast.success("Conversation copied", {
                description: "The conversation transcript has been copied to your clipboard.",
            });
        } catch (err) {
            toast.error("Failed to copy", {
                description: "There was an error copying to clipboard.",
            });
        }
    };

    const shareConversation = async () => {
        const text = getConversationText();
        if (!text) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Cencori AI Conversation",
                    text: text,
                });
            } catch (err) {
                // Ignore abort errors
                if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err);
                }
            }
        } else {
            // Fallback to copy
            copyConversation();
        }
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
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">Ask AI</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {(messages.length > 0 || attachedPage) && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors" onClick={copyConversation}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" align="end">
                                            <p>Copy conversation</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors" onClick={shareConversation}>
                                                <Share className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" align="end">
                                            <p>Share conversation</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 transition-colors" onClick={clearChat}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                </svg>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" align="end">
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
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col border-t-0 border-border/40">
                        {messages.length === 0 && !streamingContent && (
                            <div className="space-y-4 mt-auto">
                                <div className="space-y-2">
                                    {suggestedQuestions.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(q.text)}
                                            className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors flex items-center gap-3 text-muted-foreground hover:text-foreground group"
                                        >
                                            <q.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span>{q.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((message) => (
                            <div key={message.id} className={`${message.role === "user" ? "flex flex-col items-end" : ""}`}>
                                {message.role === "user" ? (
                                    <>
                                        {message.attachedPage && (
                                            <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-start gap-3 mb-2 max-w-[85%] w-full">
                                                <div className="h-8 w-8 shrink-0 rounded bg-background border border-border/40 flex items-center justify-center text-muted-foreground">
                                                    <File className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0 py-0.5">
                                                    <h5 className="text-[12px] font-medium text-foreground truncate">{message.attachedPage.title}</h5>
                                                    <p className="text-[10px] text-muted-foreground truncate opacity-70">{baseUrl}/docs/{message.attachedPage.slug}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2">
                                            <p className="text-sm">{message.content}</p>
                                        </div>
                                    </>
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

                    {/* Input Area */}
                    <div className="p-4 bg-background/50 backdrop-blur-sm">
                        <div className="space-y-3">
                            {/* Attached Page Context Card */}
                            <AnimatePresence mode="wait">
                                {attachedPage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="relative group bg-muted/30 border border-border/50 rounded-xl p-3 flex items-start gap-3 transition-all hover:bg-muted/40"
                                    >
                                        <div className="h-10 w-10 shrink-0 rounded-lg bg-background border border-border/40 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                                            <File className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <h5 className="text-[13px] font-medium text-foreground truncate">{attachedPage.title}</h5>
                                            <p className="text-[11px] text-muted-foreground truncate opacity-70">{baseUrl}/docs/{attachedPage.slug}</p>
                                        </div>
                                        <button
                                            onClick={() => setAttachedPage(null)}
                                            className="h-6 w-6 absolute -top-2 -right-2 rounded-full bg-background border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

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
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
