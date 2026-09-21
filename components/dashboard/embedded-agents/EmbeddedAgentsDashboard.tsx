"use client";

import { useQuery } from "@tanstack/react-query";
import { useProjectIdBySlug } from "@/lib/hooks/useQueries";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

function useGet<T>(projectId: string | undefined, path: string, key: string) {
    return useQuery<T | null>({
        queryKey: [key, projectId],
        queryFn: async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/${path}`);
                if (!res.ok) return null;
                return (await res.json()) as T;
            } catch {
                return null;
            }
        },
        enabled: !!projectId,
        staleTime: 30_000,
    });
}

interface ChecklistItem {
    label: string;
    description: string;
    done: boolean | null;
    href?: string;
}

export function EmbeddedAgentsDashboard({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
    const { data: projectId, isLoading: projectLoading } = useProjectIdBySlug(orgSlug, projectSlug);

    const agents = useGet<{ agents?: unknown[] } | unknown[]>(projectId, "agents", "embedded-agents");
    const webhooks = useGet<unknown[]>(projectId, "webhooks", "embedded-webhooks");
    const billingStats = useGet<{ totalRevenue?: number; activeUsers?: number }>(projectId, "end-user-billing/stats?period=30d", "embedded-billing-stats");
    const aiStats = useGet<{ totalRequests?: number; totalCost?: number }>(projectId, "ai/stats?period=30d", "embedded-ai-stats");
    const embedded = useGet<{
        tenants?: number; installations?: number; knowledge_bases?: number;
        runs_7d?: number; run_success_rate_7d?: number | null;
        pending_actions?: number; unhealthy_connections?: number; failing_webhooks?: number;
    }>(projectId, "embedded-agents/summary", "embedded-summary");

    if (projectLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (!projectId) {
        return <p className="text-sm text-muted-foreground">Project not found.</p>;
    }

    const agentCount = Array.isArray(agents.data) ? agents.data.length : (agents.data as { agents?: unknown[] } | null)?.agents?.length ?? 0;
    const webhookCount = Array.isArray(webhooks.data) ? webhooks.data.length : 0;
    const summary = embedded.data ?? {};

    const checklist: ChecklistItem[] = [
        {
            label: "Discover models",
            description: "GET /v1/models returns the unified registry (cencori + BYOK + synced).",
            done: null,
            href: "/docs/embedded-agents",
        },
        {
            label: "Connect a provider",
            description: `Add a BYOK or OpenAI-compatible provider via POST /v1/provider-connections.${(summary.unhealthy_connections ?? 0) > 0 ? ` ${summary.unhealthy_connections} connection(s) need attention.` : ""}`,
            done: null,
        },
        {
            label: "Create tenants",
            description: `Upsert downstream companies via POST /v1/tenants.${(summary.tenants ?? 0) > 0 ? ` ${summary.tenants} tenant(s) live.` : ""}`,
            done: (summary.tenants ?? 0) > 0,
        },
        {
            label: "Publish an agent version",
            description: "Draft → validate → test → review → publish. Agents dashboard shows gateway agents.",
            done: agentCount > 0,
            href: `/${orgSlug}/${projectSlug}/deployments`,
        },
        {
            label: "Install for a tenant",
            description: `POST /v1/agent-installations binds version + knowledge + connections.${(summary.installations ?? 0) > 0 ? ` ${summary.installations} active installation(s).` : ""}`,
            done: (summary.installations ?? 0) > 0,
        },
        {
            label: "Attach knowledge",
            description: `POST /v1/knowledge-bases + sources, grant to the installation.${(summary.knowledge_bases ?? 0) > 0 ? ` ${summary.knowledge_bases} knowledge base(s).` : ""}`,
            done: (summary.knowledge_bases ?? 0) > 0,
        },
        {
            label: "Run and approve safely",
            description: `Background runs with approvals.${(summary.runs_7d ?? 0) > 0 ? ` ${summary.runs_7d} run(s) in 7d${summary.run_success_rate_7d != null ? `, ${(summary.run_success_rate_7d * 100).toFixed(0)}% success` : ""}.` : ""}${(summary.pending_actions ?? 0) > 0 ? ` ${summary.pending_actions} action(s) awaiting approval.` : ""}`,
            done: (summary.runs_7d ?? 0) > 0,
        },
        {
            label: "Subscribe to webhooks",
            description: "run.*, action.*, knowledge_source.* events keep your product in sync.",
            done: webhookCount > 0,
            href: `/${orgSlug}/${projectSlug}/webhooks`,
        },
        {
            label: "Meter usage",
            description: "GET /v1/usage/export groups spend by tenant and agent for invoicing.",
            done: (billingStats.data?.totalRevenue ?? 0) > 0 || (aiStats.data?.totalRequests ?? 0) > 0,
            href: `/${orgSlug}/${projectSlug}/monetization`,
        },
    ];

    const doneCount = checklist.filter((c) => c.done === true).length;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
                <DashboardCard title="Checklist progress" value={`${doneCount}/${checklist.length}`} subtitle="Live where dashboard APIs exist" />
                <DashboardCard title="Requests (30d)" value={String(aiStats.data?.totalRequests ?? "—")} subtitle="AI gateway" />
                <DashboardCard title="AI cost (30d)" value={aiStats.data?.totalCost != null ? `$${Number(aiStats.data.totalCost).toFixed(2)}` : "—"} subtitle="Provider + markup" />
                <DashboardCard title="End-user revenue (30d)" value={billingStats.data?.totalRevenue != null ? `$${Number(billingStats.data.totalRevenue).toFixed(2)}` : "—"} subtitle="Customer billing" />
            </div>

            <div className="rounded-lg border p-5">
                <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">API readiness checklist</h2>
                    <Badge variant="secondary">M3 private alpha</Badge>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                    Items marked live are verified against this project. API-only items run through secret-key endpoints — see the quick-start below.
                </p>
                <ul className="space-y-3">
                    {checklist.map((item) => (
                        <li key={item.label} className="flex items-start gap-3">
                            {item.done === true ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                            ) : (
                                <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    {item.label}
                                    {item.done === null && (
                                        <Badge variant="outline" className="text-[10px]">
                                            via API
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                            {item.href && (
                                <a href={item.href} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                    Open <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rounded-lg border p-5">
                <h2 className="mb-2 text-sm font-semibold">Quick-start: first tenant-scoped response</h2>
                <pre className="overflow-x-auto rounded-md bg-muted p-4 text-[11px] leading-relaxed">
{`# 1. Discover models
curl -H "Authorization: Bearer $CENCORI_API_KEY" \\
  "$BASE/v1/models?available=true"

# 2. Create a tenant (idempotent)
curl -X POST -H "Authorization: Bearer $CENCORI_API_KEY" \\
  -H "Idempotency-Key: tenant-acme-v1" \\
  -d '{"external_id":"company_123","name":"Acme Ltd"}' \\
  "$BASE/v1/tenants"

# 3. Install a published agent version
curl -X POST -H "Authorization: Bearer $CENCORI_API_KEY" \\
  -d '{"tenant_id":"ten_...","agent_id":"agt_...","version":"1.0.0"}' \\
  "$BASE/v1/agent-installations"

# 4. Mint a browser token, then POST /v1/sessions + turns with ect_`}
                </pre>
            </div>
        </div>
    );
}
