"use client";

import Image from "next/image";
import Link from "next/link";
import { Copy, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { toast } from "sonner";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface SharedChatUIProps {
    messages: Message[];
    title?: string;
    createdAt?: string;
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

export function SharedChatUI({ messages, title, createdAt }: SharedChatUIProps) {
    const handleCopyUrl = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard");
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center">
            {/* Header */}
            <header className="w-full border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <div className="container max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
                        <CencoriLogo className="w-6 h-6" />
                        <span>Cencori</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-2">
                            <Share className="h-4 w-4" />
                            Share
                        </Button>
                        <Button asChild size="sm">
                            <Link href="/">Try Cencori</Link>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Chat Content */}
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 space-y-8">
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-2xl font-bold">{title || "AI Conversation"}</h1>
                    {createdAt && (
                        <p className="text-sm text-muted-foreground">
                            Shared on {new Date(createdAt).toLocaleDateString()}
                        </p>
                    )}
                </div>

                <div className="space-y-6">
                    {messages.map((message, i) => (
                        <div key={i} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase">
                                    {message.role === "user" ? "User" : "AI"}
                                </span>
                            </div>

                            {message.role === "user" ? (
                                <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                </div>
                            ) : (
                                <div className="w-full max-w-none bg-muted/30 border border-border/50 rounded-2xl rounded-tl-sm px-6 py-4">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <MarkdownRenderer content={message.content} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="w-full py-8 border-t border-border/40 mt-auto">
                <div className="container max-w-3xl mx-auto px-4 text-center space-y-4">
                    <h3 className="text-lg font-semibold">Build better software with Cencori</h3>
                    <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                        Cencori helps developers build, deploy, and scale AI applications with ease.
                    </p>
                    <Button asChild size="lg" className="mt-4">
                        <Link href="/">Get Started for Free</Link>
                    </Button>
                </div>
            </footer>
        </div>
    );
}
