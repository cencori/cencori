import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { AGENT_READ_NAMES, AGENT_READ_TOOLS, AGENT_TOOL_STATUS, runAgentReadTool } from "@/lib/copilot/agent-tools";
import { BUSINESS_TOOLS, BUSINESS_TOOL_NAMES, BUSINESS_TOOL_STATUS, runBusinessTool } from "@/lib/copilot/business-tools";
import { REMEMBER_TOOLS, REMEMBER_TOOL_NAMES, REMEMBER_TOOL_STATUS, runRememberTool } from "@/lib/copilot/remember";

/**
 * Read-only tools for Cencori Copilot (app/api/agent).
 *
 * Every tool runs server-side with the admin client, but only after the route
 * has verified the signed-in user's access to `ctx.organization` (and
 * `ctx.project`), and every query is pinned to those ids — the model chooses
 * filters, never scope. Nothing here writes, and nothing returns secrets
 * (no key hashes, no raw flagged text).
 */

export type CopilotToolContext = {
    admin: ReturnType<typeof createAdminClient>;
    organization: { id: string; name: string; slug: string };
    project: { id: string; name: string; slug: string } | null;
    /** Who's asking: chats are unread or not for them. */
    userId?: string;
    /** A business account (Studio): its owner's employee also reads money, orders, bookings, customers and chats. */
    business?: boolean;
};

type Range = "24h" | "7d" | "30d";

const RANGE_MS: Record<Range, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
};

const rangeParam = {
    type: "string",
    enum: ["24h", "7d", "30d"],
    description: "Time window ending now. Defaults to 7d.",
} as const;

function since(range: unknown): string {
    const key = (typeof range === "string" && range in RANGE_MS ? range : "7d") as Range;
    return new Date(Date.now() - RANGE_MS[key]).toISOString();
}

function clampLimit(value: unknown, fallback: number, max: number): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}

function round(value: number, precision = 6) {
    const m = 10 ** precision;
    return Math.round(value * m) / m;
}

// Last user message in a stored request payload, trimmed: the first message is
// usually a long system prompt and says little about what was asked.
function payloadPreview(payload: unknown, max = 500): string | null {
    if (!payload || typeof payload !== "object") return null;
    const messages = (payload as { messages?: Array<{ role?: string; content?: unknown }> }).messages;
    if (!Array.isArray(messages)) return null;
    const last = [...messages].reverse().find((m) => m?.role === "user") ?? messages[messages.length - 1];
    const content = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
    return content ? content.slice(0, max) : null;
}

function responsePreview(payload: unknown, max = 500): string | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as { content?: unknown; choices?: Array<{ message?: { content?: unknown } }>; text?: unknown };
    const value = p.choices?.[0]?.message?.content ?? p.content ?? p.text;
    if (typeof value === "string") return value.slice(0, max);
    return value ? JSON.stringify(value).slice(0, max) : null;
}

const PROJECT_TOOLS = new Set([
    "search_requests",
    "get_request",
    "list_security_incidents",
    "get_project_settings",
    "list_api_keys",
    "get_memory_stats",
    "search_memories",
    ...AGENT_READ_NAMES,
    ...BUSINESS_TOOL_NAMES,
    ...REMEMBER_TOOL_NAMES,
]);

export const COPILOT_TOOLS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "get_usage_summary",
            description:
                "Totals, per-model and per-provider breakdown, and daily activity (requests, tokens, spend, latency, delivery rate) for the current project or the whole organization. Covers all environments.",
            parameters: {
                type: "object",
                properties: {
                    range: rangeParam,
                    scope: {
                        type: "string",
                        enum: ["project", "organization"],
                        description: "Defaults to project when one is selected, else organization.",
                    },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_requests",
            description:
                "Search the current project's AI request log, newest first. Use for specific requests, errors, slow calls, or a given model/provider.",
            parameters: {
                type: "object",
                properties: {
                    range: rangeParam,
                    status: {
                        type: "string",
                        description: "Exact status, e.g. success, error, filtered, blocked_output, success_fallback.",
                    },
                    model: { type: "string", description: "Exact model id." },
                    provider: { type: "string", description: "Exact provider id." },
                    min_latency_ms: { type: "number", description: "Only requests at least this slow." },
                    limit: { type: "number", description: "Max rows, default 15, max 30." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_request",
            description: "One request from the current project in detail, with short previews of the prompt and response.",
            parameters: {
                type: "object",
                properties: { id: { type: "string", description: "Request id from search_requests." } },
                required: ["id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_security_incidents",
            description:
                "Security incidents for the current project (jailbreaks, prompt injection, PII, content filters), newest first.",
            parameters: {
                type: "object",
                properties: {
                    range: rangeParam,
                    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                    limit: { type: "number", description: "Max rows, default 15, max 30." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_billing",
            description:
                "The organization's plan, credit balance, monthly request usage and limit, and subscription status.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "get_project_settings",
            description:
                "The current project's settings: failover (enabled, fallback provider/model, retries), timeout, region, budget and spend cap.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "list_api_keys",
            description:
                "The current project's API keys: name, prefix, environment, type, status, created and last used. Never returns secrets.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "list_projects",
            description: "All projects in the organization.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "search_memories",
            description: "Find stored memories in the current project by text, newest first. Returns ids for delete_memory.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Text to look for; omit for the newest." },
                    limit: { type: "number", description: "Max rows, default 15, max 30." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_memory_stats",
            description: "How many active memories the current project stores, by namespace.",
            parameters: { type: "object", properties: {} },
        },
    },
];

COPILOT_TOOLS.push(...AGENT_READ_TOOLS);

/** The tools available for this context (project-only tools need a project; the business's own data is for business accounts). */
export function toolsFor(ctx: CopilotToolContext): ChatCompletionFunctionTool[] {
    if (!ctx.project) return COPILOT_TOOLS.filter((t) => !PROJECT_TOOLS.has(t.function.name));
    return ctx.business ? [...COPILOT_TOOLS, ...BUSINESS_TOOLS, ...REMEMBER_TOOLS] : COPILOT_TOOLS;
}

/** Short label shown in the panel while a tool runs. */
export const TOOL_STATUS: Record<string, string> = {
    get_usage_summary: "Reading usage",
    search_requests: "Searching requests",
    get_request: "Opening request",
    list_security_incidents: "Checking security",
    get_billing: "Checking billing",
    get_project_settings: "Reading settings",
    list_api_keys: "Listing API keys",
    list_projects: "Listing projects",
    get_memory_stats: "Checking memory",
    search_memories: "Searching memories",
    ...AGENT_TOOL_STATUS,
    ...BUSINESS_TOOL_STATUS,
    ...REMEMBER_TOOL_STATUS,
};

type Args = Record<string, unknown>;

export async function runCopilotTool(name: string, args: Args, ctx: CopilotToolContext): Promise<unknown> {
    const { admin, organization, project } = ctx;
    if (PROJECT_TOOLS.has(name) && !project) {
        return { error: "No project is selected, so project data isn't available." };
    }

    if (AGENT_READ_NAMES.has(name)) return runAgentReadTool(name, args, ctx);
    if (BUSINESS_TOOL_NAMES.has(name)) return ctx.business ? runBusinessTool(name, args, ctx) : { error: "That's only for business accounts." };
    if (REMEMBER_TOOL_NAMES.has(name)) return ctx.business ? runRememberTool(name, args, ctx) : { error: "That's only for business accounts." };

    switch (name) {
        case "get_usage_summary": {
            const scope = args.scope === "organization" || !project ? "organization" : "project";
            let projectIds: string[];
            if (scope === "project" && project) {
                projectIds = [project.id];
            } else {
                const { data } = await admin.from("projects").select("id").eq("organization_id", organization.id);
                projectIds = (data ?? []).map((p) => p.id);
            }
            if (projectIds.length === 0) return { scope, range: args.range ?? "7d", total_requests: 0 };

            const { data, error } = await admin.rpc("org_usage_stats", {
                p_project_ids: projectIds,
                p_start: since(args.range),
            });
            if (error) return { error: "Usage summary is unavailable right now." };
            const r = data as {
                total_requests: number; successful_requests: number; total_tokens: number; total_cost: number;
                avg_latency: number; model_usage: Record<string, number>; provider_usage: Record<string, number>;
                hourly: Array<{ hour: string; count: number; input_tokens: number; output_tokens: number; cost?: number }>;
            };
            const daily = new Map<string, { requests: number; tokens: number }>();
            for (const h of r.hourly ?? []) {
                const day = h.hour.slice(0, 10);
                const d = daily.get(day) ?? { requests: 0, tokens: 0 };
                d.requests += h.count;
                d.tokens += h.input_tokens + h.output_tokens;
                daily.set(day, d);
            }
            return {
                scope,
                name: scope === "project" ? project?.name : organization.name,
                range: args.range ?? "7d",
                total_requests: r.total_requests,
                delivery_rate_percent: r.total_requests ? round((r.successful_requests / r.total_requests) * 100, 1) : 0,
                total_tokens: r.total_tokens,
                spend_usd: round(Number(r.total_cost)),
                average_latency_ms: r.avg_latency,
                requests_by_model: r.model_usage,
                requests_by_provider: r.provider_usage,
                daily_utc: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
            };
        }

        case "search_requests": {
            let query = admin
                .from("ai_requests")
                .select("id, created_at, status, model, provider, total_tokens, cost_usd, latency_ms, error_message, environment, fallback_provider, fallback_model")
                .eq("project_id", project!.id)
                .gte("created_at", since(args.range))
                .order("created_at", { ascending: false })
                .limit(clampLimit(args.limit, 15, 30));
            if (typeof args.status === "string" && args.status) query = query.eq("status", args.status);
            if (typeof args.model === "string" && args.model) query = query.eq("model", args.model);
            if (typeof args.provider === "string" && args.provider) query = query.eq("provider", args.provider);
            if (Number.isFinite(Number(args.min_latency_ms)) && Number(args.min_latency_ms) > 0) {
                query = query.gte("latency_ms", Number(args.min_latency_ms));
            }
            const { data, error } = await query;
            if (error) return { error: "Request search failed." };
            return {
                count: data?.length ?? 0,
                requests: (data ?? []).map((r) => ({
                    ...r,
                    error_message: r.error_message ? String(r.error_message).slice(0, 300) : null,
                })),
            };
        }

        case "get_request": {
            if (typeof args.id !== "string") return { error: "An id is required." };
            const { data, error } = await admin
                .from("ai_requests")
                .select("id, created_at, status, model, provider, endpoint, environment, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, error_message, filtered_reasons, safety_score, fallback_provider, fallback_model, request_payload, response_payload")
                .eq("project_id", project!.id)
                .eq("id", args.id)
                .maybeSingle();
            if (error || !data) return { error: "No request with that id in this project." };
            const { request_payload, response_payload, ...rest } = data;
            return {
                ...rest,
                prompt_preview: payloadPreview(request_payload),
                response_preview: responsePreview(response_payload),
            };
        }

        case "list_security_incidents": {
            let query = admin
                .from("security_incidents")
                .select("id, created_at, incident_type, severity, action_taken, description, detection_method, risk_score, confidence, environment, reviewed")
                .eq("project_id", project!.id)
                .gte("created_at", since(args.range))
                .order("created_at", { ascending: false })
                .limit(clampLimit(args.limit, 15, 30));
            if (typeof args.severity === "string" && args.severity) query = query.eq("severity", args.severity);
            const { data, error } = await query;
            if (error) return { error: "Security incidents are unavailable right now." };
            return { count: data?.length ?? 0, incidents: data ?? [] };
        }

        case "get_billing": {
            const { data, error } = await admin
                .from("organizations")
                .select("subscription_tier, subscription_status, subscription_current_period_end, credits_balance, monthly_requests_used, monthly_request_limit, usage_reset_at, billing_frozen")
                .eq("id", organization.id)
                .maybeSingle();
            if (error || !data) return { error: "Billing is unavailable right now." };
            return { organization: organization.name, ...data };
        }

        case "get_project_settings": {
            const [{ data, error }, { data: failover }] = await Promise.all([
                admin
                    .from("projects")
                    .select("name, slug, status, region, request_timeout_seconds, monthly_budget, spend_cap, enforce_spend_cap, budget_alerts_enabled, end_user_billing_enabled, created_at")
                    .eq("id", project!.id)
                    .maybeSingle(),
                // Failover lives in project_settings; it's what the gateway reads.
                admin
                    .from("project_settings")
                    .select("enable_fallback, fallback_provider, fallback_model, max_retries_before_fallback, circuit_breaker_enabled")
                    .eq("project_id", project!.id)
                    .maybeSingle(),
            ]);
            if (error || !data) return { error: "Project settings are unavailable right now." };
            return { ...data, failover: failover ?? { enable_fallback: false, note: "No failover configured." } };
        }

        case "search_memories": {
            let query = admin
                .from("gateway_memories")
                .select("id, content, namespace, created_at, importance")
                .eq("project_id", project!.id)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(clampLimit(args.limit, 15, 30));
            if (typeof args.query === "string" && args.query.trim()) {
                query = query.ilike("content", `%${args.query.trim().replace(/[%_]/g, "")}%`);
            }
            const { data, error } = await query;
            if (error) return { error: "Memory search failed." };
            return {
                count: data?.length ?? 0,
                memories: (data ?? []).map((m) => ({ ...m, content: String(m.content ?? "").slice(0, 300) })),
            };
        }

        case "list_api_keys": {
            const { data, error } = await admin
                .from("api_keys")
                .select("id, name, key_prefix, environment, key_type, is_active, revoked_at, created_at, last_used_at, allowed_models")
                .eq("project_id", project!.id)
                .order("created_at", { ascending: false })
                .limit(50);
            if (error) return { error: "API keys are unavailable right now." };
            return { count: data?.length ?? 0, keys: data ?? [] };
        }

        case "list_projects": {
            const { data, error } = await admin
                .from("projects")
                .select("name, slug, status, region, default_model, created_at")
                .eq("organization_id", organization.id)
                .order("created_at", { ascending: true });
            if (error) return { error: "Projects are unavailable right now." };
            return { organization: organization.name, count: data?.length ?? 0, projects: data ?? [] };
        }

        case "get_memory_stats": {
            const { data, error } = await admin
                .from("gateway_memories")
                .select("namespace")
                .eq("project_id", project!.id)
                .eq("status", "active")
                .limit(5000);
            if (error) return { error: "Memory stats are unavailable right now." };
            const byNamespace: Record<string, number> = {};
            for (const row of data ?? []) {
                const ns = row.namespace || "default";
                byNamespace[ns] = (byNamespace[ns] ?? 0) + 1;
            }
            return { active_memories: data?.length ?? 0, by_namespace: byNamespace };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}
