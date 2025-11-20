"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle } from "lucide-react";

interface GitHubInstallDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgSlug: string;
    onConfirm: (accountType: 'user' | 'organization', accountLogin?: string) => void;
}

export function GitHubInstallDialog({
    open,
    onOpenChange,
    orgSlug,
    onConfirm,
}: GitHubInstallDialogProps) {
    const [accountType, setAccountType] = useState<'user' | 'organization'>('organization');
    const [orgName, setOrgName] = useState('');
    const [error, setError] = useState('');

    const handleConfirm = () => {
        setError('');

        if (accountType === 'organization' && !orgName.trim()) {
            setError('Please enter your GitHub organization name');
            return;
        }

        onConfirm(accountType, accountType === 'organization' ? orgName.trim() : undefined);
    };

    // Suggest GitHub org name based on Cencori org slug
    const suggestedOrgName = orgSlug.replace(/[^a-zA-Z0-9-]/g, '-');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Install GitHub App</DialogTitle>
                    <DialogDescription>
                        Choose where to install the Cencori GitHub App
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Account Type Selection */}
                    <div className="space-y-3">
                        <Label>Install Location</Label>
                        <RadioGroup value={accountType} onValueChange={(value) => setAccountType(value as 'user' | 'organization')}>
                            <div className="flex items-start space-x-3 space-y-0">
                                <RadioGroupItem value="user" id="user" />
                                <div className="space-y-1 leading-none">
                                    <Label htmlFor="user" className="font-normal cursor-pointer">
                                        Personal Account
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Install on your personal GitHub account
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 space-y-0">
                                <RadioGroupItem value="organization" id="organization" />
                                <div className="space-y-1 leading-none">
                                    <Label htmlFor="organization" className="font-normal cursor-pointer">
                                        Organization
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Install on a GitHub organization (recommended)
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Organization Name Input */}
                    {accountType === 'organization' && (
                        <div className="space-y-2">
                            <Label htmlFor="org-name">
                                GitHub Organization Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="org-name"
                                placeholder={`e.g., ${suggestedOrgName}`}
                                value={orgName}
                                onChange={(e) => {
                                    setOrgName(e.target.value);
                                    setError('');
                                }}
                                className={error ? 'border-red-500' : ''}
                            />
                            {error && (
                                <p className="text-sm text-red-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {error}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                                Enter the exact name of your GitHub organization
                            </p>
                        </div>
                    )}

                    {/* Recommendation */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                            <strong>Recommendation:</strong> Install on your GitHub organization to share repositories with your team.
                        </p>
                    </div>

                    {/* Important Note */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3">
                        <div className="flex gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-900 dark:text-amber-100 space-y-1">
                                <p className="font-medium">Important</p>
                                <p>You must have admin access to the GitHub account/organization to install the app.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>
                        Continue to GitHub
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
