"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/auth-client";

// Better Auth's default password length bounds.
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // false = the account signs in with Google/GitHub/Apple only and has no
    // password to change; it gets a link to set one instead.
    hasPassword: boolean;
    email: string | null;
};

export function ChangePasswordDialog({ open, onOpenChange, hasPassword, email }: Props) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [signOutOthers, setSignOutOthers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setSignOutOthers(true);
            setError(null);
        }
    }, [open]);

    const handleChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword.length < MIN_LENGTH) {
            setError(`New password must be at least ${MIN_LENGTH} characters.`);
            return;
        }
        if (newPassword.length > MAX_LENGTH) {
            setError(`New password must be at most ${MAX_LENGTH} characters.`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("New passwords don't match.");
            return;
        }
        if (newPassword === currentPassword) {
            setError("New password must be different from your current one.");
            return;
        }

        setSubmitting(true);
        try {
            const { error: apiError } = await authClient.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: signOutOthers,
            });
            if (apiError) {
                setError(
                    apiError.code === "INVALID_PASSWORD"
                        ? "Your current password is incorrect."
                        : apiError.message ?? "Could not change your password.",
                );
                return;
            }
            toast.success(signOutOthers ? "Password changed. Other devices were signed out." : "Password changed");
            onOpenChange(false);
        } catch {
            setError("Could not change your password. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendSetLink = async () => {
        if (!email) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (!res.ok) throw new Error();
            toast.success(`We sent a link to ${email} to set your password.`);
            onOpenChange(false);
        } catch {
            setError("Could not send the email. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                {hasPassword ? (
                    <form onSubmit={handleChange} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Change password</DialogTitle>
                            <DialogDescription>
                                Enter your current password, then choose a new one.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="current-password" className="text-xs">Current password</Label>
                                <Input
                                    id="current-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="new-password" className="text-xs">New password</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                                <p className="text-[11px] text-muted-foreground">At least {MIN_LENGTH} characters.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="confirm-password" className="text-xs">Confirm new password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={signOutOthers}
                                    onChange={(e) => setSignOutOthers(e.target.checked)}
                                    className="h-3.5 w-3.5"
                                />
                                Sign out of all other devices
                            </label>
                        </div>

                        {error && <p className="text-xs text-red-500">{error}</p>}

                        <DialogFooter>
                            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Spinner className="h-3 w-3 mr-1.5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Change password"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Set a password</DialogTitle>
                            <DialogDescription>
                                You sign in with a connected account, so there's no password to change yet. We'll
                                email {email ?? "you"} a link to set one — after that you can also sign in with your
                                email and password.
                            </DialogDescription>
                        </DialogHeader>

                        {error && <p className="text-xs text-red-500">{error}</p>}

                        <DialogFooter>
                            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button type="button" size="sm" onClick={handleSendSetLink} disabled={submitting || !email}>
                                {submitting ? (
                                    <>
                                        <Spinner className="h-3 w-3 mr-1.5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Email me a link"
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
