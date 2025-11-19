"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface GenerateKeyDialogProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onKeyGenerated: () => void;
}

export function GenerateKeyDialog({
    projectId,
    open,
    onOpenChange,
    onKeyGenerated,
}: GenerateKeyDialogProps) {
    const [keyName, setKeyName] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!keyName.trim()) {
            toast.error("Please enter a name for your API key");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/api-keys`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: keyName }),
            });

            if (!response.ok) {
                throw new Error("Failed to generate API key");
            }

            const data = await response.json();
            setGeneratedKey(data.apiKey);
            toast.success("API key generated successfully!");
        } catch (error) {
            console.error("Error generating API key:", error);
            toast.error("Failed to generate API key");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (generatedKey) {
            await navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            toast.success("API key copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        if (generatedKey) {
            onKeyGenerated();
        }
        setGeneratedKey(null);
        setKeyName("");
        setCopied(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[525px]">
                {!generatedKey ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Generate API Key</DialogTitle>
                            <DialogDescription>
                                Create a new API key for this project. Give it a descriptive name to help you
                                remember what it&apos;s used for.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="key-name">Key Name</Label>
                                <Input
                                    id="key-name"
                                    placeholder="e.g., Production API Key"
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleGenerate();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleGenerate} disabled={loading || !keyName.trim()}>
                                {loading ? "Generating..." : "Generate Key"}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>API Key Generated</DialogTitle>
                            <DialogDescription>
                                <div className="flex items-start gap-2 mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                    <span className="text-sm text-amber-900 dark:text-amber-100">
                                        Make sure to copy your API key now. You won&apos;t be able to see it again!
                                    </span>
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Your API Key</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={generatedKey}
                                        readOnly
                                        className="font-mono text-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleCopy}
                                        className="shrink-0"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleClose}>Done</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
