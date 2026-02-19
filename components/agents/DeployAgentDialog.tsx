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
import { Check, Copy, Loader2, ArrowRight } from "lucide-react";
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
    const [, startTransition] = useTransition();

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

    const getBlueprintSetup = (blueprint: string, apiKey: string, agentId: string) => {
        const envVars = `# Connect to Cencori\nexport OPENAI_BASE_URL=https://cencori.com/api/v1\nexport OPENAI_API_KEY=${apiKey}\nexport CENCORI_AGENT_ID=${agentId}`;
        switch (blueprint) {
            case "openclaw":
                return {
                    title: "How OpenClaw Works",
                    description: "Your agent is ready. Use these variables to connect OpenClaw to Cencori.",
                    notes: [
                        "Runs locally on your computer",
                        "Connects securely to Cencori's Gateway",
                        "Shadow Mode requires approval for risky actions",
                    ],
                    command: `# Step 1: Install OpenClaw\ncurl -sSL https://openclaw.ai/install.sh | bash\n\n# Step 2: Configure\n${envVars}\n\n# Step 3: Run\nopenclaw onboard`,
                    helpText: "This command installs and runs OpenClaw with your unique key.",
                };
            case "n8n":
                return {
                    title: "How n8n Workflow Works",
                    description: "Your agent is ready. Start n8n and create an OpenAI credential pointing to Cencori.",
                    notes: [
                        "Build AI workflows visually in n8n",
                        "Use Cencori as OpenAI-compatible backend",
                        "Select any model from your Cencori agent config",
                    ],
                    command: `# Step 1: Start n8n\nnpx n8n start\n\n# Step 2: In n8n, create OpenAI credential\n# Base URL: https://cencori.com/api/v1\n# API Key: ${apiKey}\n\n# Step 3: In OpenAI Chat Model node\n# Model: gpt-4o-mini (or your configured Cencori model)\n\n# Optional: set routing override in n8n host env\nexport CENCORI_AGENT_ID=${agentId}`,
                    helpText: "Use the Base URL and API key above in n8n OpenAI credentials.",
                };
            case "autogpt":
                return {
                    title: "How AutoGPT Works",
                    description: "Your agent is ready. Use these variables to connect AutoGPT to Cencori.",
                    notes: [
                        "Recursive task planning and execution",
                        "Long-running autonomous loops",
                        "Shadow Mode guardrails in Cencori",
                    ],
                    command: `# Step 1: Install AutoGPT\npip install autogpt\n\n# Step 2: Configure\n${envVars}\n\n# Step 3: Run\nautogpt run`,
                    helpText: "This command configures and starts AutoGPT with your Cencori key.",
                };
            case "crewai":
                return {
                    title: "How CrewAI Works",
                    description: "Your agent is ready. Use these variables to connect CrewAI to Cencori.",
                    notes: [
                        "Role-based multi-agent orchestration",
                        "Task delegation across specialists",
                        "Centralized model control in Cencori",
                    ],
                    command: `# Step 1: Install CrewAI\npip install crewai\n\n# Step 2: Configure\n${envVars}`,
                    helpText: "Set these variables before running your CrewAI project.",
                };
            case "python-interpreter":
                return {
                    title: "How Python Sandbox Works",
                    description: "Your agent is ready. Use these variables in your Python runtime.",
                    notes: [
                        "Execute model-generated Python safely",
                        "Route requests through Cencori governance",
                        "Track usage and behavior in Live Feed",
                    ],
                    command: `# Step 1: Install dependencies\npip install openai\n\n# Step 2: Configure\n${envVars}`,
                    helpText: "Set these variables before your Python OpenAI client runs.",
                };
            default:
                return {
                    title: "How This Agent Works",
                    description: "Your agent is ready. Use these variables to connect it to Cencori.",
                    notes: [
                        "OpenAI-compatible endpoint",
                        "Centralized monitoring and controls",
                        "Model routing from Cencori dashboard",
                    ],
                    command: envVars,
                    helpText: "Set these variables in your runtime environment.",
                };
        }
    };
    const previewSetup = getBlueprintSetup(blueprintId, "<YOUR_API_KEY>", "<YOUR_AGENT_ID>");
    const setup = result ? getBlueprintSetup(blueprintId, result.apiKey, result.agentId) : previewSetup;
    const connectCommand = setup?.command || "";

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
                                <p className="font-medium mb-1">{previewSetup.title}:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {previewSetup.notes.map((note) => (
                                        <li key={note}>{note}</li>
                                    ))}
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
                                {setup?.description || "Your agent is ready. Add these variables to connect your runtime."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-mono uppercase text-muted-foreground">Environment Variables</Label>
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
                                    <div className="pr-8 break-all space-y-1">
                                        {connectCommand.split('\n').map((line, i) => (
                                            <div key={i}><span className="text-green-500">$</span> {line}</div>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    {setup?.helpText || "Use these values in your runtime configuration."}
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
