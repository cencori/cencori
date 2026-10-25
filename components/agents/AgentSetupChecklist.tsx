"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { readJson, useWidgetPreview } from "@/components/agents/widget-preview";
import { useAgentsBasePath } from "@/components/agents/studio";
import { isBusinessTemplate } from "@/lib/embedded/templates";
import { cn } from "@/lib/utils";

type Step = { id: string; title: string; detail: string; done: boolean; action: React.ReactNode };

/**
 * What's left to get a business template's agent answering guests: shown on
 * the overview until every step is done.
 */
export function AgentSetupChecklist() {
    const { projectId, agent, version } = useAgentWorkspace();
    const basePath = `${useAgentsBasePath()}/${encodeURIComponent(agent.id)}`;
    const { setMode, openPanel } = useWidgetPreview();
    const template = version?.config_json.template;
    const enabled = isBusinessTemplate(template);

    const api = `/api/projects/${projectId}/embedded-agents/${agent.id}`;
    const knowledge = useQuery({
        queryKey: ["agent-knowledge", projectId, agent.id],
        queryFn: async () => readJson<{ sources?: Array<{ status: string }> }>(await fetch(`${api}/knowledge`, { cache: "no-store" })),
        enabled,
    });
    const whatsapp = useQuery({
        queryKey: ["agent-whatsapp", projectId, agent.id],
        queryFn: async () => readJson<{ channel: { webhook_verified: boolean } | null }>(await fetch(`${api}/whatsapp`, { cache: "no-store" })),
        enabled,
    });
    if (!enabled || knowledge.isLoading || whatsapp.isLoading) return null;

    // Connected apps as stored: each names its app (`nango.integration`) and its switched-on tools.
    const apps = Array.isArray(version?.config_json.integrations) ? version.config_json.integrations as Array<{ nango?: { integration?: unknown }; enabled?: unknown }> : [];
    const calendar = apps.some((app) => app?.nango?.integration === "google-calendar" && Array.isArray(app.enabled) && app.enabled.length > 0);
    const published = !!agent.stable_version_id;
    const link = (href: string, label: string) => <Button asChild size="sm" variant="outline" className="h-7 text-xs"><Link href={href}>{label}</Link></Button>;

    const steps: Step[] = [
        {
            id: "menu",
            title: "Add your menu",
            detail: "Dishes and prices the host answers from. A PDF or a pasted list both work.",
            done: (knowledge.data?.sources ?? []).some((source) => source.status === "ready"),
            action: link(`${basePath}/knowledge`, "Add menu"),
        },
        {
            id: "calendar",
            title: "Connect Google Calendar",
            detail: "Where bookings go. Each reservation becomes an event you can see on your phone.",
            done: calendar,
            action: link(`${basePath}/tools?tab=integrations`, "Connect"),
        },
        {
            id: "try",
            title: "Try it",
            detail: "Ask about the menu and book a table in Preview, the way a guest would.",
            done: !!version?.last_test_passed || published,
            action: <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setMode("draft"); openPanel(); }}>Open Preview</Button>,
        },
        {
            id: "publish",
            title: "Publish",
            detail: "Guests always talk to the published version.",
            done: published,
            action: null,
        },
        {
            id: "whatsapp",
            title: "Connect WhatsApp",
            detail: "Guests message your WhatsApp number and the host replies.",
            done: !!whatsapp.data?.channel?.webhook_verified,
            action: link(`${basePath}/settings`, "Connect"),
        },
    ];
    const left = steps.filter((step) => !step.done).length;
    if (left === 0) return null;
    const next = steps.find((step) => !step.done)?.id;

    return (
        <section className="mb-6 rounded-lg border border-border/40 bg-muted/30">
            <header className="flex items-baseline justify-between gap-4 border-b border-border/40 px-5 py-3">
                <h2 className="text-sm font-medium">Finish setting up</h2>
                <span className="text-xs text-muted-foreground">{steps.length - left} of {steps.length} done</span>
            </header>
            <ol>
                {steps.map((step, index) => (
                    <li key={step.id} className={cn("flex items-center gap-3 px-5 py-3", index > 0 && "border-t border-border/40")}>
                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]", step.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground")}>
                            {step.done ? <Check className="h-3 w-3" /> : index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className={cn("text-sm", step.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{step.title}</p>
                            {!step.done && <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>}
                        </div>
                        {!step.done && step.id === next && step.action}
                    </li>
                ))}
            </ol>
        </section>
    );
}
