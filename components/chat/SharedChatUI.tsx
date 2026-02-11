"use client";

import Link from "next/link";
import { Copy, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { toast } from "sonner";
import Navbar from "@/components/landing/Navbar";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface SharedChatUIProps {
    messages: Message[];
    title?: string;
    createdAt?: string;
}

export function SharedChatUI({ messages, title, createdAt }: SharedChatUIProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });

    useEffect(() => {
        const checkUser = async () => {
            const { data, error } = await supabase.auth.getSession();
            if (data?.session) {
                setIsAuthenticated(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const meta = user.user_metadata ?? {};
                    const avatar = meta.avatar_url ?? meta.picture ?? null;
                    const name = meta.name ?? user.email?.split("@")[0] ?? null;
                    setUserProfile({ name: name as string | null, avatar: avatar as string | null });
                }
            } else {
                setIsAuthenticated(false);
                setUserProfile({ name: null, avatar: null });
            }
        };
        checkUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: any | null) => {
            if (session) {
                setIsAuthenticated(true);
                const { user } = session;
                if (user) {
                    const meta = user.user_metadata ?? {};
                    const avatar = meta.avatar_url ?? meta.picture ?? null;
                    const name = meta.name ?? user.email?.split("@")[0] ?? null;
                    setUserProfile({ name: name as string | null, avatar: avatar as string | null });
                }
            } else {
                setIsAuthenticated(false);
                setUserProfile({ name: null, avatar: null });
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard");
    };

    const unauthenticatedActions = [
        { text: "Sign in", href: siteConfig.links.signInUrl, isButton: false },
        {
            text: "Get Started",
            href: siteConfig.links.getStartedUrl,
            isButton: true,
            variant: "default",
        },
    ];

    const authenticatedActions = [
        {
            text: "Dashboard",
            href: "/dashboard/organizations",
            isButton: true,
            variant: "default",
        },
        {
            text: userProfile.name || "User",
            href: "#",
            isButton: false,
            isAvatar: true,
            avatarSrc: userProfile.avatar,
            avatarFallback: (userProfile.name || "U").slice(0, 2).toUpperCase(),
        },
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col items-center">
            <Navbar
                logo={<Logo variant="mark" className="h-4" />}
                name="cencori"
                homeUrl="/"
                actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
                isAuthenticated={isAuthenticated}
                userProfile={isAuthenticated ? userProfile : undefined}
            />

            {/* Chat Content */}
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 space-y-8 mt-20">
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-2xl font-bold">{title || "AI Conversation"}</h1>
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                        {createdAt && (
                            <span>Shared on {new Date(createdAt).toLocaleDateString()}</span>
                        )}
                        <Button variant="ghost" size="sm" onClick={handleCopyUrl} className="h-auto px-2 py-1 gap-1.5 text-xs">
                            <Share className="h-3.5 w-3.5" />
                            Share Link
                        </Button>
                    </div>
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
