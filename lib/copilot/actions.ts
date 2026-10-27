import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { CopilotToolContext } from "@/lib/copilot/tools";
import { AGENT_ACTIONS, AGENT_ACTION_NAMES, AGENT_TOOL_STATUS, prepareAgentAction } from "@/lib/copilot/agent-tools";

/**
 * Write actions for Cencori Copilot.
 *
 * The model never performs a write. When it calls one of these tools the
 * server validates the arguments, resolves the target inside the verified
 * project, and returns a proposal: a confirmation card the panel renders.
 * Nothing happens until the user clicks Confirm, and then the panel calls the
 * same dashboard endpoint the dashboard's own button uses — as the user, with
 * that endpoint's permission checks and audit log. Billing, payments and
 * deleting projects or organizations are deliberately not actions.
 */

export type CopilotActionTier = "normal" | "destructive";

export type CopilotActionProposal = {
    id: string;
    kind: string;
    title: string;
    tier: CopilotActionTier;
    // What the card shows, in order.
    details: Array<{ label: string; value: string }>;
    // Destructive actions: the user types this to enable Confirm.
    confirmPhrase?: string;
    // The dashboard endpoint Confirm calls. Built here, never by the model.
    request: CopilotActionRequest;
    // Several requests in a row, when one change needs more than one call
    // (create an agent, then add its knowledge). "{{agent_id}}"-style
    // placeholders in a path or body take values the earlier responses returned.
    steps?: CopilotActionRequest[];
    // Not a write: Confirm opens this console page, for things that need the
    // user's own sign-in (connecting WhatsApp, Google Calendar), in a new tab.
    // sameTab: Copilot taking the user somewhere, once they agree to leave
    // unsaved edits behind.
    link?: { href: string; label: string; sameTab?: boolean };
    // Past-tense line shown once it succeeds.
    doneMessage: string;
};

export type CopilotActionRequest = { method: "POST" | "PATCH" | "PUT" | "DELETE"; path: string; body?: Record<string, unknown> };

export type PrepareResult =
    | { proposal: CopilotActionProposal }
    | { error: string };

const keyRef = {
    type: "string",
    description: "The key's id, exact name, or prefix (as returned by list_api_keys).",
} as const;

export const COPILOT_ACTIONS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "create_api_key",
            description: "Propose creating a new API key for the current project. Runs only after the user confirms; the key is shown to them once.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "A short name for the key." },
                    environment: { type: "string", enum: ["production", "test"], description: "Defaults to production." },
                    key_type: { type: "string", enum: ["secret", "publishable"], description: "Defaults to secret." },
                },
                required: ["name"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_api_key",
            description: "Propose renaming an API key and/or limiting which models it may call (allow_all_models: true removes the limit).",
            parameters: {
                type: "object",
                properties: {
                    key: keyRef,
                    new_name: { type: "string" },
                    allowed_models: {
                        type: "array",
                        items: { type: "string" },
                        description: "Exact model ids this key may call.",
                    },
                    allow_all_models: { type: "boolean", description: "true removes any model limit." },
                },
                required: ["key"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "revoke_api_key",
            description: "Propose revoking an API key. Destructive: apps using it stop working immediately.",
            parameters: { type: "object", properties: { key: keyRef }, required: ["key"] },
        },
    },
    {
        type: "function",
        function: {
            name: "set_fallback",
            description: "Propose changing the project's failover: whether fallback is on, and which provider/model to fall back to.",
            parameters: {
                type: "object",
                properties: {
                    enable_fallback: { type: "boolean" },
                    fallback_provider: { type: "string", description: "Provider id, e.g. openai, anthropic, groq." },
                    fallback_model: { type: "string", description: "Exact model id on that provider." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_budget",
            description: "Propose changing the project's monthly budget, spend cap, whether the cap is enforced, or budget alerts. Amounts in USD.",
            parameters: {
                type: "object",
                properties: {
                    monthly_budget: { type: "number" },
                    spend_cap: { type: "number" },
                    clear_monthly_budget: { type: "boolean", description: "true removes the monthly budget." },
                    clear_spend_cap: { type: "boolean", description: "true removes the spend cap." },
                    enforce_spend_cap: { type: "boolean" },
                    budget_alerts_enabled: { type: "boolean" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "review_security_incident",
            description: "Propose marking a security incident as reviewed, with an optional note.",
            parameters: {
                type: "object",
                properties: {
                    incident_id: { type: "string", description: "From list_security_incidents." },
                    note: { type: "string" },
                },
                required: ["incident_id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "delete_memory",
            description: "Propose permanently deleting one stored memory. Destructive.",
            parameters: {
                type: "object",
                properties: { memory_id: { type: "string", description: "From search_memories." } },
                required: ["memory_id"],
            },
        },
    },
];

COPILOT_ACTIONS.push(...AGENT_ACTIONS);

export const ACTION_NAMES = new Set(COPILOT_ACTIONS.map((a) => a.function.name));

export const ACTION_STATUS: Record<string, string> = {
    create_api_key: "Preparing a new key",
    update_api_key: "Preparing key changes",
    revoke_api_key: "Preparing to revoke",
    set_fallback: "Preparing failover change",
    set_budget: "Preparing budget change",
    review_security_incident: "Preparing review",
    delete_memory: "Preparing to delete",
    ...AGENT_TOOL_STATUS,
};

type Args = Record<string, unknown>;

const usd = (n: number | null) => (n === null ? "None" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
const onOff = (b: boolean) => (b ? "On" : "Off");

async function findKey(ctx: CopilotToolContext, ref: unknown) {
    if (typeof ref !== "string" || !ref.trim()) return { error: "Say which key (id, name or prefix)." } as const;
    const needle = ref.trim().replace(/\.{3}$/, "");
    const { data } = await ctx.admin
        .from("api_keys")
        .select("id, name, key_prefix, environment, revoked_at, allowed_models")
        .eq("project_id", ctx.project!.id)
        .is("revoked_at", null);
    const keys = data ?? [];
    const matches = keys.filter((k) =>
        k.id === needle
        || k.name?.toLowerCase() === needle.toLowerCase()
        || (needle.length >= 6 && k.key_prefix?.replace(/\.{3}$/, "").startsWith(needle)),
    );
    if (matches.length === 0) return { error: `No active key matches "${ref}".` } as const;
    if (matches.length > 1) {
        return { error: `"${ref}" matches ${matches.length} keys (${matches.map((k) => `${k.name} ${k.key_prefix}`).join(", ")}); use the id.` } as const;
    }
    return { key: matches[0] } as const;
}

export async function prepareCopilotAction(name: string, args: Args, ctx: CopilotToolContext): Promise<PrepareResult> {
    if (AGENT_ACTION_NAMES.has(name)) return prepareAgentAction(name, args, ctx);
    const project = ctx.project;
    if (!project) return { error: "Select a project first; actions apply to a project." };
    const base = `/api/projects/${project.id}`;
    const id = crypto.randomUUID();

    switch (name) {
        case "create_api_key": {
            const keyName = typeof args.name === "string" ? args.name.trim() : "";
            if (!keyName || keyName.length > 100) return { error: "A key name (1-100 characters) is required." };
            const environment = args.environment === "test" ? "test" : "production";
            const keyType = args.key_type === "publishable" ? "publishable" : "secret";
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: "Create API key",
                    details: [
                        { label: "Name", value: keyName },
                        { label: "Environment", value: environment },
                        { label: "Type", value: keyType },
                        { label: "Project", value: project.name },
                    ],
                    request: { method: "POST", path: `${base}/api-keys`, body: { name: keyName, environment, key_type: keyType } },
                    doneMessage: `Created API key "${keyName}".`,
                },
            };
        }

        case "update_api_key": {
            const found = await findKey(ctx, args.key);
            if ("error" in found) return { error: found.error as string };
            const body: Record<string, unknown> = {};
            const details: Array<{ label: string; value: string }> = [{ label: "Key", value: `${found.key.name} (${found.key.key_prefix})` }];
            if (typeof args.new_name === "string" && args.new_name.trim()) {
                body.name = args.new_name.trim().slice(0, 100);
                details.push({ label: "New name", value: body.name as string });
            }
            if (args.allow_all_models === true || "allowed_models" in args) {
                if (args.allow_all_models === true || args.allowed_models === null) {
                    body.allowed_models = null;
                    details.push({ label: "Allowed models", value: "All models" });
                } else if (Array.isArray(args.allowed_models) && args.allowed_models.every((m) => typeof m === "string" && m.trim())) {
                    body.allowed_models = (args.allowed_models as string[]).map((m) => m.trim());
                    details.push({ label: "Allowed models", value: (body.allowed_models as string[]).join(", ") });
                } else {
                    return { error: "allowed_models must be a list of model ids, or null for all models." };
                }
            }
            if (Object.keys(body).length === 0) return { error: "Nothing to change: give a new_name and/or allowed_models." };
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: "Update API key",
                    details,
                    request: { method: "PATCH", path: `${base}/api-keys/${found.key.id}/settings`, body },
                    doneMessage: `Updated API key "${(body.name as string) ?? found.key.name}".`,
                },
            };
        }

        case "revoke_api_key": {
            const found = await findKey(ctx, args.key);
            if ("error" in found) return { error: found.error as string };
            return {
                proposal: {
                    id, kind: name, tier: "destructive",
                    title: "Revoke API key",
                    details: [
                        { label: "Key", value: `${found.key.name} (${found.key.key_prefix})` },
                        { label: "Environment", value: found.key.environment ?? "—" },
                        { label: "Effect", value: "Apps using this key stop working immediately." },
                    ],
                    confirmPhrase: found.key.name,
                    request: { method: "PATCH", path: `${base}/api-keys/${found.key.id}` },
                    doneMessage: `Revoked API key "${found.key.name}".`,
                },
            };
        }

        case "set_fallback": {
            const body: Record<string, unknown> = {};
            const details: Array<{ label: string; value: string }> = [{ label: "Project", value: project.name }];
            if (typeof args.enable_fallback === "boolean") {
                body.enable_fallback = args.enable_fallback;
                details.push({ label: "Fallback", value: onOff(args.enable_fallback) });
            }
            if (typeof args.fallback_provider === "string" && args.fallback_provider.trim()) {
                body.fallback_provider = args.fallback_provider.trim();
                details.push({ label: "Fallback provider", value: body.fallback_provider as string });
            }
            if (typeof args.fallback_model === "string" && args.fallback_model.trim()) {
                body.fallback_model = args.fallback_model.trim();
                details.push({ label: "Fallback model", value: body.fallback_model as string });
            }
            if (Object.keys(body).length === 0) return { error: "Nothing to change: give enable_fallback, fallback_provider and/or fallback_model." };
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: "Change failover",
                    details,
                    request: { method: "PATCH", path: `${base}/settings`, body },
                    doneMessage: "Updated failover settings.",
                },
            };
        }

        case "set_budget": {
            const body: Record<string, unknown> = {};
            const details: Array<{ label: string; value: string }> = [{ label: "Project", value: project.name }];
            for (const field of ["monthly_budget", "spend_cap"] as const) {
                const clear = args[`clear_${field}`] === true;
                if (!clear && !(field in args)) continue;
                const v = clear ? null : args[field];
                if (v === null) body[field] = null;
                else if (typeof v === "number" && Number.isFinite(v) && v >= 0) body[field] = Math.round(v * 100) / 100;
                else return { error: `${field} must be a non-negative number or null.` };
                details.push({ label: field === "monthly_budget" ? "Monthly budget" : "Spend cap", value: usd(body[field] as number | null) });
            }
            if (typeof args.enforce_spend_cap === "boolean") {
                body.enforce_spend_cap = args.enforce_spend_cap;
                details.push({ label: "Enforce spend cap", value: onOff(args.enforce_spend_cap) });
            }
            if (typeof args.budget_alerts_enabled === "boolean") {
                body.budget_alerts_enabled = args.budget_alerts_enabled;
                details.push({ label: "Budget alerts", value: onOff(args.budget_alerts_enabled) });
            }
            if (Object.keys(body).length === 0) return { error: "Nothing to change." };
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: "Change budget",
                    details,
                    request: { method: "PUT", path: `${base}/budget`, body },
                    doneMessage: "Updated budget settings.",
                },
            };
        }

        case "review_security_incident": {
            if (typeof args.incident_id !== "string") return { error: "An incident_id is required." };
            const { data: incident } = await ctx.admin
                .from("security_incidents")
                .select("id, incident_type, severity, description, reviewed")
                .eq("project_id", project.id)
                .eq("id", args.incident_id)
                .maybeSingle();
            if (!incident) return { error: "No incident with that id in this project." };
            if (incident.reviewed) return { error: "That incident is already reviewed." };
            const note = typeof args.note === "string" ? args.note.trim().slice(0, 1000) : "";
            return {
                proposal: {
                    id, kind: name, tier: "normal",
                    title: "Mark incident reviewed",
                    details: [
                        { label: "Incident", value: `${incident.severity} · ${incident.incident_type}` },
                        { label: "Description", value: String(incident.description ?? "").slice(0, 160) || "—" },
                        ...(note ? [{ label: "Note", value: note }] : []),
                    ],
                    request: {
                        method: "PATCH",
                        path: `${base}/security/incidents/${incident.id}`,
                        body: { reviewed: true, ...(note ? { review_notes: note } : {}) },
                    },
                    doneMessage: "Marked the incident reviewed.",
                },
            };
        }

        case "delete_memory": {
            if (typeof args.memory_id !== "string") return { error: "A memory_id is required." };
            const { data: memory } = await ctx.admin
                .from("gateway_memories")
                .select("id, content, namespace")
                .eq("project_id", project.id)
                .eq("id", args.memory_id)
                .maybeSingle();
            if (!memory) return { error: "No memory with that id in this project." };
            const preview = String(memory.content ?? "").slice(0, 160);
            return {
                proposal: {
                    id, kind: name, tier: "destructive",
                    title: "Delete memory",
                    details: [
                        { label: "Memory", value: preview || "—" },
                        { label: "Namespace", value: memory.namespace || "default" },
                        { label: "Effect", value: "Permanently deleted; it can't be recalled again." },
                    ],
                    confirmPhrase: "delete",
                    request: { method: "DELETE", path: `${base}/memory/entries/${memory.id}` },
                    doneMessage: "Deleted the memory.",
                },
            };
        }

        default:
            return { error: `Unknown action: ${name}` };
    }
}
