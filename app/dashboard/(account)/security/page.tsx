"use client";

import React from "react";
import { ShieldCheck, Key, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SecurityPage() {
    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h1 className="text-xl font-semibold">Security</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your account security and authentication settings.
                </p>
            </div>

            {/* Password */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium">Password</h2>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                <Key className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Password</p>
                                <p className="text-xs text-muted-foreground">
                                    Last changed: Never
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => toast.info("Password change coming soon!")}
                        >
                            Change password
                        </Button>
                    </div>
                </div>
            </section>

            {/* Two-Factor Authentication */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium">Two-Factor Authentication</h2>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Authenticator App</p>
                                <p className="text-xs text-muted-foreground">
                                    Add an extra layer of security
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => toast.info("2FA setup coming soon!")}
                        >
                            Enable 2FA
                        </Button>
                    </div>
                </div>
            </section>

            {/* Sessions */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium">Active Sessions</h2>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Current Session</p>
                                <p className="text-xs text-muted-foreground">
                                    This device • Active now
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    You can sign out of all other sessions if you suspect unauthorized access.
                </p>
            </section>
        </div>
    );
}
