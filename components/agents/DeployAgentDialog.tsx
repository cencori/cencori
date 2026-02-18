"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Loader2, Play, Terminal, ArrowRight } from "lucide-react";
import { createAgent } from "@/app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/agents/actions";
import { toast } from "sonner";

interface DeployAgentDialogProps {
    children: React.ReactNode;
    blueprintId: string;
    blueprintTitle: string;
    projectId: string;
    orgSlug: string;
    projectSlug: string;
}

export function DeployAgentDialog({
    children,
    blueprintId,
    blueprintTitle,
    projectId,
    orgSlug,
    projectSlug
}: DeployAgentDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'name' | 'deploying' | 'success'>('name');
    const [agentName, setAgentName] = useState("");
    const [result, setResult] = useState<{ agentId: string, apiKey: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleDeploy = () => {
        if (!agentName) {
            toast.error("Please enter an agent name");
            return;
        }

        setStep('deploying');

        startTransition(async () => {
            try {
                const res = await createAgent({
                    orgSlug,
                    projectSlug,
                    projectId,
                    blueprintId,
                    name: agentName
                });

                if (res?.success) {
                    setResult({ agentId: res.agentId, apiKey: res.apiKey });
                    setStep('success');
                } else {
                    toast.error("Failed to create agent");
                    setStep('name');
                }
            } catch (error) {
                console.error(error);
                toast.error("An unexpected error occurred");
                setStep('name');
            }
        });
    };

    const handleGoToAgent = () => {
        if (!result) return;
        setOpen(false);
        router.push(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/agents/${result.agentId}`);
    };

    const connectCommand = result ? `npx openclaw connect --key=${result.apiKey}` : "";

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                {step === 'name' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Deploy {blueprintTitle}</DialogTitle>
                            <DialogDescription>
                                Give your agent a name to identify it in your dashboard.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Agent Name</Label>
                                <Input
                                    id="name"
                                    placeholder={`My ${blueprintTitle} Agent`}
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                                <p className="font-medium mb-1">How OpenClaw Works:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Runs locally on your computer</li>
                                    <li>Connects securely to Cencori's Gateway</li>
                                    <li>"Shadow Mode" requires approval for risky actions</li>
                                </ul>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button onClick={handleDeploy}>Next: Instructions</Button>
                        </DialogFooter>
                    </>
                )}

                {step === 'deploying' && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <div>
                            <h3 className="text-lg font-medium">Deploying Agent...</h3>
                            <p className="text-sm text-muted-foreground">Setting up secure channels and configuration.</p>
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-green-500">
                                <Check className="w-5 h-5" />
                                Agent Deployed!
                            </DialogTitle>
                            <DialogDescription>
                                Your agent is ready. Run this command in your terminal to connect it.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-mono uppercase text-muted-foreground">Connection Command</Label>
                                <div className="relative rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-100 border border-zinc-800">
                                    <div className="absolute right-2 top-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-zinc-400 hover:text-white"
                                            onClick={() => {
                                                navigator.clipboard.writeText(connectCommand);
                                                toast.success("Command copied");
                                            }}
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="pr-8 break-all">
                                        <span className="text-green-500">$</span> {connectCommand}
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    This command installs and runs the OpenClaw client with your unique key.
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button className="w-full gap-2" onClick={handleGoToAgent}>
                                Go to Dashboard <ArrowRight className="w-4 h-4" />
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
