"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Logo } from "@/components/logo";

const ALLOWED_EMAIL_DOMAINS = ['cencori.com'];

export default function InternalSignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            const form = e.currentTarget;
            const fd = new FormData(form);
            const email = String(fd.get("email") ?? "").trim().toLowerCase();
            const password = String(fd.get("password") ?? "");
            const confirm = String(fd.get("confirm-password") ?? "");

            if (!email) {
                setError("Please enter a valid email.");
                setLoading(false);
                return;
            }

            // Check email domain restriction
            const emailDomain = email.split('@')[1];
            if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
                setError("Only @cencori.com emails allowed.");
                setLoading(false);
                return;
            }

            if (password.length < 8) {
                setError("Password must be at least 8 characters.");
                setLoading(false);
                return;
            }

            if (password !== confirm) {
                setError("Passwords do not match.");
                setLoading(false);
                return;
            }

            const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""}/internal/kpi`;

            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: redirectTo,
                    data: { is_internal: true, role: 'team_member' }
                },
            });

            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
                return;
            }

            // Email confirmation disabled - redirect directly to dashboard
            router.push("/internal/kpi");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Unexpected error";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-svh flex flex-col items-center justify-center p-4 bg-background">
            <div className="w-full max-w-xs space-y-6">
                {/* Header */}
                <div className="flex justify-center">
                    <Link href="/">
                        <Logo variant="full" className="h-5" />
                    </Link>
                </div>

                {/* Card - Cenpact style */}
                <div className="border border-border/40 rounded-lg bg-card/50 p-4 space-y-4">
                    <div className="space-y-1 text-center">
                        <h1 className="text-sm font-medium">Internal Access</h1>
                        <p className="text-[11px] text-muted-foreground">@cencori.com only</p>
                    </div>

                    {error && (
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-[11px] text-destructive">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-[11px] text-green-600 dark:text-green-400">
                            {success}
                        </div>
                    )}

                    <form className="space-y-3" onSubmit={handleSubmit}>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Work Email</Label>
                            <Input
                                name="email"
                                type="email"
                                placeholder="you@cencori.com"
                                required
                                className="h-8 text-[11px] rounded-md bg-muted/30 border-border/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</Label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="At least 8 characters"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                className="h-8 text-[11px] rounded-md bg-muted/30 border-border/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                            <Input
                                name="confirm-password"
                                type="password"
                                required
                                autoComplete="new-password"
                                className="h-8 text-[11px] rounded-md bg-muted/30 border-border/50"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-8 text-[11px] rounded-md"
                        >
                            {loading ? "Creating..." : "Create Account"}
                        </Button>
                    </form>

                    <p className="text-center text-[10px] text-muted-foreground">
                        Have access?{" "}
                        <Link href="/internal/kpi/login" className="text-foreground hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
