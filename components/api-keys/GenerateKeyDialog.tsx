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
import { Copy, Check, AlertCircle, Globe, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { Badge } from "@/components/ui/badge";

interface GenerateKeyDialogProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onKeyGenerated: () => void;
}

type KeyType = "secret" | "publishable";

export function GenerateKeyDialog({
    projectId,
    open,
    onOpenChange,
    onKeyGenerated,
}: GenerateKeyDialogProps) {
    const { environment, isTestMode } = useEnvironment();
    const [keyName, setKeyName] = useState("");
    const [keyType, setKeyType] = useState<KeyType>("secret");
    const [domainInput, setDomainInput] = useState("");
    const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const addDomain = () => {
        const domain = domainInput.trim().toLowerCase();
        if (domain && !allowedDomains.includes(domain)) {
            setAllowedDomains([...allowedDomains, domain]);
            setDomainInput("");
        }
    };

    const removeDomain = (domain: string) => {
        setAllowedDomains(allowedDomains.filter(d => d !== domain));
    };

    const handleGenerate = async () => {
        if (!keyName.trim()) {
            toast.error("Please enter a name for your API key");
            return;
        }

        if (keyType === "publishable" && allowedDomains.length === 0) {
            toast.error("Please add at least one allowed domain for publishable keys");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/api-keys`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: keyName,
                    environment,
                    key_type: keyType,
                    allowed_domains: keyType === "publishable" ? allowedDomains : null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(errorData.error || "Failed to generate API key");
            }

            const data = await response.json();
            setGeneratedKey(data.apiKey.full_key);
            toast.success("API key generated successfully!");
        } catch (error) {
            console.error("Error generating API key:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to generate API key";
            toast.error(errorMessage);
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
        setKeyType("secret");
        setAllowedDomains([]);
        setDomainInput("");
        setCopied(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[440px] p-0 top-[20%] translate-y-0">
                {!generatedKey ? (
                    <>
                        <DialogHeader className="px-4 pt-4 pb-0">
                            <DialogTitle className="text-sm font-medium">Generate API key</DialogTitle>
                            <DialogDescription className="text-xs">
                                Create a new API key for this project.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="px-4 py-4 space-y-4">
                            {/* Key Type Selection */}
                            <div className="space-y-2">
                                <Label className="text-xs">Key type</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setKeyType("secret")}
                                        className={`flex items-center gap-2 p-2.5 rounded-md border text-left transition-colors ${keyType === "secret"
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                            }`}
                                    >
                                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs font-medium">Secret</p>
                                            <p className="text-[10px] text-muted-foreground">Server-side only</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setKeyType("publishable")}
                                        className={`flex items-center gap-2 p-2.5 rounded-md border text-left transition-colors ${keyType === "publishable"
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                            }`}
                                    >
                                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs font-medium">Publishable</p>
                                            <p className="text-[10px] text-muted-foreground">Browser-safe</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Key Name */}
                            <div className="space-y-1.5">
                                <Label htmlFor="key-name" className="text-xs">Key name</Label>
                                <Input
                                    id="key-name"
                                    placeholder={isTestMode ? "e.g., Development key" : "e.g., Production key"}
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && keyType === "secret") {
                                            handleGenerate();
                                        }
                                    }}
                                    className="h-8 text-xs"
                                />
                            </div>

                            {/* Allowed Domains (for publishable keys) */}
                            {keyType === "publishable" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Allowed domains</Label>
                                    <p className="text-[10px] text-muted-foreground">
                                        Only requests from these domains will be accepted. Use *.example.com for wildcards.
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g., localhost, *.myapp.com"
                                            value={domainInput}
                                            onChange={(e) => setDomainInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addDomain();
                                                }
                                            }}
                                            className="h-8 text-xs"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs px-3"
                                            onClick={addDomain}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                    {allowedDomains.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {allowedDomains.map((domain) => (
                                                <Badge
                                                    key={domain}
                                                    variant="secondary"
                                                    className="text-[10px] px-2 py-0.5 gap-1"
                                                >
                                                    {domain}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDomain(domain)}
                                                        className="ml-0.5 hover:text-destructive"
                                                    >
                                                        <X className="h-2.5 w-2.5" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <DialogFooter className="px-4 pb-4 pt-0 gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleGenerate}
                                disabled={loading || !keyName.trim() || (keyType === "publishable" && allowedDomains.length === 0)}
                            >
                                {loading ? "Generating..." : "Generate"}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader className="px-4 pt-4 pb-0">
                            <DialogTitle className="text-sm font-medium">API key generated</DialogTitle>
                        </DialogHeader>
                        <div className="px-4 py-3">
                            <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                    Copy your API key now. You won&apos;t be able to see it again.
                                </span>
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Your API key</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={generatedKey}
                                        readOnly
                                        className="h-8 text-xs font-mono bg-secondary/50"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleCopy}
                                        className="h-8 w-8 shrink-0"
                                    >
                                        {copied ? (
                                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="px-4 pb-4 pt-0">
                            <Button size="sm" className="h-7 text-xs" onClick={handleClose}>Done</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
