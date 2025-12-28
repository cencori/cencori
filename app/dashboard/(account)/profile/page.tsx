"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UserProfile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar_url: string | null;
    email: string;
}

export default function ProfilePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");
    const [isDirty, setIsDirty] = useState(false);

    // Fetch user profile
    const { data: profile, isLoading } = useQuery<UserProfile>({
        queryKey: ["userProfile"],
        queryFn: async () => {
            const response = await fetch("/api/user/profile");
            if (!response.ok) throw new Error("Failed to fetch profile");
            const data = await response.json();
            return data.profile;
        },
    });

    // Sync form state when profile loads
    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || "");
            setLastName(profile.last_name || "");
            setUsername(profile.username || "");
            setIsDirty(false);
        }
    }, [profile]);

    // Handle form changes
    const handleChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setter(e.target.value);
        setIsDirty(true);
    };

    // Save profile
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    username: username || null,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save profile");
            }

            toast.success("Profile updated");
            setIsDirty(false);
            queryClient.invalidateQueries({ queryKey: ["userProfile"] });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    };

    // Delete account
    const handleDeleteAccount = async () => {
        try {
            const response = await fetch("/api/user/profile", {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete account");
            }

            await supabase.auth.signOut();
            router.push("/");
            toast.success("Account deleted");
        } catch (error) {
            toast.error("Failed to delete account");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() ||
        profile?.email?.[0]?.toUpperCase() || "?";

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h1 className="text-xl font-semibold">Profile</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your personal information and account settings.
                </p>
            </div>

            {/* Avatar Section */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium">Avatar</h2>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <button
                            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            onClick={() => toast.info("Avatar upload coming soon!")}
                        >
                            <Camera className="h-5 w-5 text-white" />
                        </button>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                            Click to upload a new avatar
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                            JPG, PNG, or GIF. Max 2MB.
                        </p>
                    </div>
                </div>
            </section>

            {/* Personal Information */}
            <section className="space-y-4">
                <h2 className="text-sm font-medium">Personal Information</h2>
                <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="firstName" className="text-xs">
                                First name
                            </Label>
                            <Input
                                id="firstName"
                                value={firstName}
                                onChange={handleChange(setFirstName)}
                                placeholder="John"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="lastName" className="text-xs">
                                Last name
                            </Label>
                            <Input
                                id="lastName"
                                value={lastName}
                                onChange={handleChange(setLastName)}
                                placeholder="Doe"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={profile?.email || ""}
                            disabled
                            className="h-9 text-sm bg-muted/50"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Email cannot be changed here. Contact support if needed.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="username" className="text-xs">
                            Username
                        </Label>
                        <div className="flex items-center">
                            <span className="h-9 px-3 flex items-center text-sm text-muted-foreground bg-muted/50 border border-r-0 border-border/60 rounded-l-md">
                                @
                            </span>
                            <Input
                                id="username"
                                value={username}
                                onChange={handleChange(setUsername)}
                                placeholder="johndoe"
                                className="h-9 text-sm rounded-l-none"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Used for public profile URL and mentions.
                        </p>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                        {isDirty ? "You have unsaved changes" : "All changes saved"}
                    </p>
                    <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!isDirty || isSaving}
                        onClick={handleSave}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save changes"
                        )}
                    </Button>
                </div>
            </section>

            {/* Danger Zone */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium text-red-500">Danger Zone</h2>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Delete Account</p>
                            <p className="text-xs text-muted-foreground">
                                Permanently delete your account and all associated data.
                            </p>
                        </div>
                        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 text-xs"
                                >
                                    <Trash2 className="h-3 w-3 mr-1.5" />
                                    Delete Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Delete Account</DialogTitle>
                                    <DialogDescription className="text-sm">
                                        This action cannot be undone. All your data, organizations, and projects will be permanently deleted.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2 py-4">
                                    <Label htmlFor="confirmDelete" className="text-xs">
                                        Type <span className="font-mono font-medium">delete my account</span> to confirm
                                    </Label>
                                    <Input
                                        id="confirmDelete"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder="delete my account"
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowDeleteDialog(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={deleteConfirmText !== "delete my account"}
                                        onClick={handleDeleteAccount}
                                    >
                                        Delete Account
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </section>
        </div>
    );
}
