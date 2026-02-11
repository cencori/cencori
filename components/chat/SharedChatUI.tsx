"use client";

import Link from "next/link";
import { Copy, Share, ArrowUp } from "lucide-react";
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
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 space-y-8 mt-20 pb-32">


                <div className="space-y-6">
                    {messages.map((message, i) => (
                        <div key={i} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>

                            {message.role === "user" ? (
                                <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2">
                                    <p className="text-sm">{message.content}</p>
                                </div>
                            ) : (
                                <div className="w-full max-w-none space-y-2">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <MarkdownRenderer content={message.content} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            {/* Simulated Input Area (Fixed Bottom) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border/40 pb-8">
                <div className="max-w-3xl mx-auto">
                    <div className="relative flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-2.5 pl-4 py-2 transition-all hover:bg-muted/30 hover:border-border/80 group cursor-text" onClick={() => (window.location.href = '/')}>
                        <div className="flex-1 py-2 text-sm text-muted-foreground">
                            Ask a question...
                        </div>
                        <div className="flex-shrink-0">
                            <Button
                                size="icon"
                                className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all"
                            >
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="text-center mt-3">
                        <Link href="/" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                            Powered by Cencori AI
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
