"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ModelSelect } from "@/components/dashboard/embedded-agents/ModelSelect";
import { STARTING_POINTS } from "@/components/agents/starting-points";
import { AgentOrb } from "@/components/agents/AgentOrb";
import { RestaurantSetup } from "@/components/agents/RestaurantSetup";
import { emptyAgentForm, MODEL_LOCK_NOTE, postStudioAction, studioQueryKey, usableModels, useAgentStudio, useAgentsBasePath, type AgentForm } from "@/components/agents/studio";
import { useProjectIdBySlug } from "@/lib/hooks/useQueries";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring";

/**
 * Making an agent, in two steps like ElevenLabs: pick a starting point (blank
 * or a template), then name it and say what it should do.
 */
export default function NewAgentPage({ params }: { params: Promise<{ orgSlug: string; projectSlug: string }> }) {
    const { orgSlug, projectSlug } = use(params);
    const router = useRouter();
    const basePath = useAgentsBasePath();
    const queryClient = useQueryClient();
    const startParam = useSearchParams().get("start");
    const preset = STARTING_POINTS.find((point) => point.id === startParam);
    const { data: projectId } = useProjectIdBySlug(orgSlug, projectSlug);
    const { data } = useAgentStudio(projectId ?? undefined);

    // A template link from the agents list skips straight to step 2.
    const [step, setStep] = useState<1 | 2>(preset ? 2 : 1);
    const [start, setStart] = useState<string>(preset?.id ?? "blank");
    const [form, setForm] = useState<AgentForm>(preset?.form ?? emptyAgentForm);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const choose = (id: string) => {
        setStart(id);
        setForm(STARTING_POINTS.find((point) => point.id === id)?.form ?? emptyAgentForm);
        setError(null);
        setStep(2);
    };

    const update = (field: keyof AgentForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setError(null);
    };

    const create = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!projectId) return;
        setBusy(true);
        try {
            const result = await postStudioAction(projectId, "create_agent", form);
            await queryClient.invalidateQueries({ queryKey: studioQueryKey(projectId) });
            toast.success("Agent created", { description: "Try it in the test panel, then publish." });
            router.push(`${basePath}/${encodeURIComponent(result.agent_id as string)}/configure`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            setBusy(false);
        }
    };

    const template = STARTING_POINTS.find((point) => point.id === start);

    return (
        <main className="relative flex min-h-[calc(100dvh-8rem)] flex-col px-4 pb-10 pt-6 sm:px-6">
            <Link href={basePath} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground sm:right-6">
                <X className="h-4 w-4" />
            </Link>

            <div className="mx-auto my-auto w-full max-w-[640px] py-8">
                {step === 1 ? (
                    <>
                        <h1 className="text-xl font-medium tracking-[-0.02em]">New agent</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Start from a blank agent or a template you can change.</p>

                        <button
                            type="button"
                            onClick={() => choose("blank")}
                            className="mt-8 flex w-full items-center gap-3 rounded-lg border border-dashed border-border/70 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                        >
                            <span className="flex-1">
                                <span className="block text-sm font-medium">Blank agent</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">Write the instructions yourself.</span>
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>

                        <p className="mb-3 mt-8 text-xs font-medium text-muted-foreground">Templates</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {STARTING_POINTS.map((point) => (
                                <button
                                    key={point.id}
                                    type="button"
                                    onClick={() => choose(point.id)}
                                    className="group rounded-lg border border-border/40 bg-muted/30 p-4 text-left transition-colors hover:bg-muted/60"
                                >
                                    <span className="flex items-center gap-2.5 text-sm font-medium">
                                        <AgentOrb seed={point.id} />
                                        <span className="min-w-0 flex-1 truncate">{point.title}</span>
                                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                    </span>
                                    <span className="mt-1.5 block text-xs text-muted-foreground">{point.detail}</span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : template?.business === "restaurant" ? (
                    <RestaurantSetup projectId={projectId} basePath={basePath} models={usableModels(data?.models ?? [])} onBack={() => setStep(1)} />
                ) : (
                    <>
                        <h1 className="text-xl font-medium tracking-[-0.02em]">Complete your agent</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {template ? `Starting from ${template.title}. ` : ""}Name it and say what it should do. You can change everything before publishing.
                        </p>

                        <form onSubmit={create} className="mt-8 space-y-6">
                            <label className="block">
                                <span className="mb-2 block text-xs font-medium">Name</span>
                                <span className="relative block">
                                    <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Research assistant" maxLength={80} className={cn(inputClass, "pr-14")} autoFocus />
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">{form.name.length}/80</span>
                                </span>
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-xs font-medium">What should this agent do?</span>
                                <textarea value={form.instructions} onChange={(event) => update("instructions", event.target.value)} placeholder="You are a helpful assistant that..." rows={7} className={`${inputClass} resize-y leading-6`} />
                                <span className="mt-1.5 block text-xs text-muted-foreground">What it does, what it avoids, and how it responds.</span>
                            </label>
                            <div>
                                <span className="mb-2 block text-xs font-medium">Model</span>
                                <ModelSelect value={form.model} onChange={(value) => update("model", value)} models={usableModels(data?.models ?? [])} placeholder="DeepSeek V4 Flash" />
                                {data?.model_locked && <p className="mt-2 text-xs text-muted-foreground">{MODEL_LOCK_NOTE}</p>}
                            </div>
                            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                            <div className="flex items-center justify-between pt-2">
                                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setStep(1)}>
                                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                                </Button>
                                <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={!form.name.trim() || busy || !projectId}>
                                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Create agent
                                </Button>
                            </div>
                        </form>
                    </>
                )}

                <div className="mt-10 flex justify-center gap-1.5" aria-hidden="true">
                    <span className={cn("h-1.5 rounded-full transition-all", step === 1 ? "w-5 bg-foreground" : "w-1.5 bg-muted-foreground/40")} />
                    <span className={cn("h-1.5 rounded-full transition-all", step === 2 ? "w-5 bg-foreground" : "w-1.5 bg-muted-foreground/40")} />
                </div>
            </div>
        </main>
    );
}
