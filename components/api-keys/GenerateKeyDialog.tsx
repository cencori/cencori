"use client";

import React, { useState, useEffect } from "react";
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
import { Copy, Check, AlertCircle, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { Badge } from "@/components/ui/badge";

interface GenerateKeyDialogProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onKeyGenerated: () => void;
    defaultKeyType?: 'secret' | 'publishable';
}

export function GenerateKeyDialog({
    projectId,
    open,
    onOpenChange,
    onKeyGenerated,
    defaultKeyType = 'secret',
}: GenerateKeyDialogProps) {
    const { environment } = useEnvironment();
    const [keyName, setKeyName] = useState("");
    const [keyType, setKeyType] = useState<'secret' | 'publishable'>(defaultKeyType);
    const [domainInput, setDomainInput] = useState("");
    const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Sync keyType with defaultKeyType when dialog opens
    useEffect(() => {
        if (open) {
            setKeyType(defaultKeyType);
        }
    }, [open, defaultKeyType]);

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
        setAllowedDomains([]);
        setDomainInput("");
        setCopied(false);
        onOpenChange(false);
    };

    // Different content based on key type
    const isPublishable = keyType === 'publishable';
    const title = isPublishable ? "Create new publishable API key" : "Create new secret API key";
    const description = isPublishable
        ? "Publishable API keys are used to authorize requests to your project from the web, mobile or desktop apps, CLIs or other public components of your application. They are safe to be published online and embedded in code."
        : "Secret API keys allow elevated access to your project's data, bypassing Row-Level security.";

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] p-0">
                {!generatedKey ? (
                    <>
                        <DialogHeader className="px-6 pt-6 pb-0">
                            <DialogTitle className="text-base font-medium">{title}</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-2">
                                {description}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="px-6 py-5 space-y-5">
                            {/* Name Field */}
                            <div className="space-y-2">
                                <Label htmlFor="key-name" className="text-sm font-medium">Name</Label>
                                <Input
                                    id="key-name"
                                    placeholder={isPublishable ? "e.g., web_app_key" : "Example: my_super_secret_key_123"}
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    className="h-10 bg-secondary/30 border-border"
                                />
                                <p className="text-xs text-muted-foreground">
                                    A short, unique name of lowercased letters, digits and underscore
                                </p>
                            </div>

                            {/* Allowed Domains (for publishable keys only) */}
                            {isPublishable && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Allowed domains</Label>
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
                                            className="h-10 bg-secondary/30 border-border"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 px-4"
                                            onClick={addDomain}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Only requests from these domains will be accepted. Use *.example.com for wildcards.
                                    </p>
                                    {allowedDomains.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {allowedDomains.map((domain) => (
                                                <Badge
                                                    key={domain}
                                                    variant="secondary"
                                                    className="text-xs px-2 py-1 gap-1"
                                                >
                                                    {domain}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDomain(domain)}
                                                        className="ml-0.5 hover:text-destructive"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Security Warning (for secret keys only) */}
                            {!isPublishable && (
                                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                                    <div className="flex gap-3">
                                        <Shield className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Securing your API key</p>
                                            <ul className="text-xs text-amber-600/90 dark:text-amber-400/90 space-y-1 list-disc list-inside">
                                                <li>Keep this key secret.</li>
                                                <li>Do not use on the web, in mobile or desktop apps.</li>
                                                <li>Don't post it publicly or commit in source control.</li>
                                                <li>This key provides elevated access to your data.</li>
                                                <li>If it leaks, swap it with a new secret API key and then delete it.</li>
                                                <li>If used in a browser, it will always return HTTP 401 Unauthorized.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter className="px-6 pb-6 pt-0">
                            <Button
                                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={handleGenerate}
                                disabled={loading || !keyName.trim() || (isPublishable && allowedDomains.length === 0)}
                            >
                                {loading ? "Creating..." : isPublishable ? "Create Publishable API key" : "Create API key"}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader className="px-6 pt-6 pb-0">
                            <DialogTitle className="text-base font-medium">API key generated</DialogTitle>
                        </DialogHeader>
                        <div className="px-6 py-4">
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                    Copy your API key now. You won&apos;t be able to see it again.
                                </span>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Your API key</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={generatedKey}
                                        readOnly
                                        className="h-10 font-mono text-xs bg-secondary/50"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleCopy}
                                        className="h-10 w-10 shrink-0"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="px-6 pb-6 pt-0">
                            <Button className="h-9 px-4" onClick={handleClose}>Done</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
