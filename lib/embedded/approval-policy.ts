/**
 * Per-tool approval rules on an installation:
 *
 *   { "default": "required", "tools": { "send_email": "required", "search_*": "auto", "delete_contact": "deny" } }
 *
 * `auto`: the tool runs without asking. `required`: a person approves each
 * call first. `deny`: the agent never gets the tool. A tool no rule matches
 * keeps what its kind decides (lib/embedded/tool-risk).
 */
export type ApprovalRule = 'auto' | 'required' | 'deny';

export interface ToolApprovalPolicy {
    default: ApprovalRule | null;
    /** Exact names, in the order written. */
    exact: Map<string, ApprovalRule>;
    /** `prefix*` patterns, longest prefix first. */
    prefixes: Array<{ prefix: string; rule: ApprovalRule }>;
}

const RULES = new Set<string>(['auto', 'required', 'deny']);
const MAX_TOOL_RULES = 500;

function isRule(value: unknown): value is ApprovalRule {
    return typeof value === 'string' && RULES.has(value);
}

/** What a create or update request sent, checked. Other keys are left alone. */
export function validateApprovalPolicy(raw: unknown): { ok: true } | { ok: false; message: string } {
    if (raw === undefined || raw === null) return { ok: true };
    if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'approval_policy must be an object' };
    const policy = raw as Record<string, unknown>;
    if (policy.default !== undefined && !isRule(policy.default)) {
        return { ok: false, message: 'approval_policy.default must be "auto", "required" or "deny"' };
    }
    if (policy.tools !== undefined) {
        if (!policy.tools || typeof policy.tools !== 'object' || Array.isArray(policy.tools)) {
            return { ok: false, message: 'approval_policy.tools must be an object of tool name to "auto", "required" or "deny"' };
        }
        const entries = Object.entries(policy.tools as Record<string, unknown>);
        if (entries.length > MAX_TOOL_RULES) return { ok: false, message: `approval_policy.tools holds at most ${MAX_TOOL_RULES} rules` };
        for (const [name, rule] of entries) {
            if (!name.trim()) return { ok: false, message: 'approval_policy.tools has an empty tool name' };
            if (!isRule(rule)) return { ok: false, message: `approval_policy.tools["${name}"] must be "auto", "required" or "deny"` };
        }
    }
    return { ok: true };
}

/** A stored policy, read leniently: anything that isn't a rule is ignored. */
export function readApprovalPolicy(raw: unknown): ToolApprovalPolicy {
    const policy: ToolApprovalPolicy = { default: null, exact: new Map(), prefixes: [] };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return policy;
    const source = raw as Record<string, unknown>;
    if (isRule(source.default)) policy.default = source.default;
    if (source.tools && typeof source.tools === 'object' && !Array.isArray(source.tools)) {
        for (const [name, rule] of Object.entries(source.tools as Record<string, unknown>)) {
            if (!isRule(rule) || !name.trim()) continue;
            if (name.endsWith('*')) policy.prefixes.push({ prefix: name.slice(0, -1), rule });
            else policy.exact.set(name, rule);
        }
        policy.prefixes.sort((a, b) => b.prefix.length - a.prefix.length);
    }
    return policy;
}

export function hasApprovalRules(policy: ToolApprovalPolicy): boolean {
    return policy.default !== null || policy.exact.size > 0 || policy.prefixes.length > 0;
}

/**
 * A hosted tool is offered to the model as `mcp__<server>__<tool>` or
 * `conn__<connection>__<operation>`; a rule may name it either way.
 */
function shortName(name: string): string | null {
    const m = /^(?:mcp|conn)__[A-Za-z0-9_-]+?__(.+)$/.exec(name);
    return m ? m[1] : null;
}

/** The rule for a tool, or null when the policy says nothing about it. */
export function ruleForTool(policy: ToolApprovalPolicy, name: string): ApprovalRule | null {
    const short = shortName(name);
    const exact = policy.exact.get(name) ?? (short ? policy.exact.get(short) : undefined);
    if (exact) return exact;
    for (const { prefix, rule } of policy.prefixes) {
        if (name.startsWith(prefix) || (short !== null && short.startsWith(prefix))) return rule;
    }
    return policy.default;
}

type OfferedTool = { type?: string; function?: { name?: string }; needsApproval?: boolean };

/**
 * The tools an installed agent is offered, after the installation's rules:
 * denied tools are gone, `required` ones are marked for approval, `auto` ones
 * are not. Built-in (non-function) tools pass through.
 */
export function applyApprovalPolicy<T extends OfferedTool>(tools: T[], policy: ToolApprovalPolicy): T[] {
    if (!hasApprovalRules(policy)) return tools;
    const out: T[] = [];
    for (const tool of tools) {
        const name = tool.type === 'function' ? tool.function?.name : undefined;
        const rule = name ? ruleForTool(policy, name) : null;
        if (!rule) { out.push(tool); continue; }
        if (rule === 'deny') continue;
        const { needsApproval: _dropped, ...rest } = tool;
        void _dropped;
        out.push((rule === 'required' ? { ...rest, needsApproval: true } : rest) as T);
    }
    return out;
}
