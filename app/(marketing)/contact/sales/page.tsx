"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { toast } from "sonner";

export default function SalesContactPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        company: "",
        message: "",
    });

    useEffect(() => {
        const checkUser = async () => {
            const { data } = await supabase.auth.getSession();
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

        const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: { user: { user_metadata?: Record<string, unknown>; email?: string } } | null) => {
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

    const navActions = isAuthenticated
        ? [
            { text: "Dashboard", href: "/dashboard/organizations", isButton: true, variant: "default" },
            { text: userProfile.name || "User", href: "#", isButton: false, isAvatar: true, avatarSrc: userProfile.avatar, avatarFallback: (userProfile.name || "U").slice(0, 2).toUpperCase() },
        ]
        : [
            { text: "Sign in", href: siteConfig.links.signInUrl, isButton: false },
            { text: "Get Started", href: siteConfig.links.getStartedUrl, isButton: true, variant: "default" },
        ];

    const handleFieldChange = (field: keyof typeof form, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);

        try {
            const name = `${form.firstName} ${form.lastName}`.trim();

            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email: form.email,
                    company: form.company,
                    type: "enterprise",
                    subject: "Sales inquiry",
                    message: form.message,
                }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.error || "Failed to send message");
            }

            setIsSubmitted(true);
            toast.success("Request sent. We’ll get back to you soon.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send message");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar
                logo={<Logo variant="mark" className="h-4" />}
                name="cencori"
                homeUrl="/"
                actions={navActions}
                isAuthenticated={isAuthenticated}
                userProfile={isAuthenticated ? userProfile : undefined}
            />

            <main>
                <section className="pt-28 pb-24 sm:pt-40 sm:pb-32">
                    <div className="mx-auto max-w-6xl px-4 md:px-6">
                        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-2 lg:gap-24">
                            <div className="pt-2">
                                <p className="mb-8 animate-appear text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                                    Cencori sales
                                </p>

                                <h1 className="mb-8 animate-appear text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.035em] [animation-delay:100ms] sm:text-[3.5rem] lg:text-[4rem]">
                                    Talk to our
                                    <br />
                                    <span className="text-muted-foreground">sales team.</span>
                                </h1>

                                <p className="mb-12 max-w-[27rem] animate-appear text-base leading-[1.7] text-muted-foreground [animation-delay:200ms]">
                                    Tell us what you&apos;re building, where you need control, and how your team wants to deploy. We&apos;ll help you scope the right rollout for production AI.
                                </p>

                                <div className="flex flex-wrap gap-6 text-[13px] text-muted-foreground animate-appear [animation-delay:300ms]">
                                    <span>Architecture review</span>
                                    <span className="text-border">|</span>
                                    <span>Security guidance</span>
                                    <span className="text-border">|</span>
                                    <span>Deployment planning</span>
                                </div>
                            </div>

                            <div className="animate-appear [animation-delay:250ms]">
                                {isSubmitted ? (
                                    <div className="py-16 text-center">
                                        <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
                                        <p className="mb-2 text-lg font-medium">Thank you</p>
                                        <p className="text-sm text-muted-foreground">
                                            We&apos;ll be in touch within one business day.
                                        </p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                                    First Name
                                                </label>
                                                <Input
                                                    placeholder="Jane"
                                                    value={form.firstName}
                                                    onChange={(event) => handleFieldChange("firstName", event.target.value)}
                                                    required
                                                    className="h-11 rounded-lg border-border/60 bg-transparent"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                                    Last Name
                                                </label>
                                                <Input
                                                    placeholder="Doe"
                                                    value={form.lastName}
                                                    onChange={(event) => handleFieldChange("lastName", event.target.value)}
                                                    required
                                                    className="h-11 rounded-lg border-border/60 bg-transparent"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                                Work Email
                                            </label>
                                            <Input
                                                type="email"
                                                placeholder="jane@company.com"
                                                value={form.email}
                                                onChange={(event) => handleFieldChange("email", event.target.value)}
                                                required
                                                className="h-11 rounded-lg border-border/60 bg-transparent"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                                Company
                                            </label>
                                            <Input
                                                placeholder="Acme Inc."
                                                value={form.company}
                                                onChange={(event) => handleFieldChange("company", event.target.value)}
                                                required
                                                className="h-11 rounded-lg border-border/60 bg-transparent"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                                Message
                                            </label>
                                            <Textarea
                                                placeholder="Tell us about your use case..."
                                                value={form.message}
                                                onChange={(event) => handleFieldChange("message", event.target.value)}
                                                required
                                                className="min-h-[90px] resize-none rounded-lg border-border/60 bg-transparent"
                                            />
                                        </div>

                                        <Button type="submit" size="sm" className="h-7 w-full px-3 text-xs" disabled={isSubmitting}>
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                "Request a Demo"
                                            )}
                                        </Button>

                                        <p className="text-center text-[11px] text-muted-foreground/50">
                                            By submitting, you agree to our{" "}
                                            <Link href="/privacy-policy" className="underline underline-offset-2 transition-colors hover:text-muted-foreground">
                                                Privacy Policy
                                            </Link>.
                                        </p>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
