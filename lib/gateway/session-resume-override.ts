import type { Tool } from '@/lib/providers/base';

/**
 * `next` on POST /v1/sessions/:id/approve: the agent configuration the resumed
 * turn runs under, instead of the paused turn's. cencori/agents sends it for a
 * handoff, where the turn paused on a transfer_to_<agent> call and the reply
 * must come from the agent it transferred to.
 */
export interface ResumeOverride {
    instructions?: string;
    model?: string;
    tools?: Tool[];
    /** Replaces keys of the turn's metadata (cencori/agents: the agent handed to). */
    metadata?: Record<string, string>;
}

const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_TOOLS = 128;
const MAX_INSTRUCTIONS = 100_000;

type Parsed = { ok: true; value: ResumeOverride | undefined } | { ok: false; message: string };

export function parseResumeOverride(raw: unknown): Parsed {
    if (raw === undefined || raw === null) return { ok: true, value: undefined };
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, message: 'next must be an object' };
    }
    const next = raw as Record<string, unknown>;
    const value: ResumeOverride = {};

    if (next.instructions !== undefined) {
        if (typeof next.instructions !== 'string' || next.instructions.length > MAX_INSTRUCTIONS) {
            return { ok: false, message: `next.instructions must be a string of at most ${MAX_INSTRUCTIONS} characters` };
        }
        value.instructions = next.instructions;
    }
    if (next.model !== undefined) {
        if (typeof next.model !== 'string' || !next.model.trim() || next.model.length > 200) {
            return { ok: false, message: 'next.model must be a model id' };
        }
        value.model = next.model.trim();
    }
    if (next.metadata !== undefined) {
        if (!next.metadata || typeof next.metadata !== 'object' || Array.isArray(next.metadata)) {
            return { ok: false, message: 'next.metadata must be an object of strings' };
        }
        const entries = Object.entries(next.metadata as Record<string, unknown>);
        if (entries.length > 20 || entries.some(([k, v]) => typeof v !== 'string' || k.length > 64 || (v as string).length > 500)) {
            return { ok: false, message: 'next.metadata takes at most 20 string values (keys up to 64, values up to 500 characters)' };
        }
        value.metadata = Object.fromEntries(entries) as Record<string, string>;
    }
    if (next.tools !== undefined) {
        if (!Array.isArray(next.tools) || next.tools.length > MAX_TOOLS) {
            return { ok: false, message: `next.tools must be an array of at most ${MAX_TOOLS} function tools` };
        }
        const tools: Tool[] = [];
        for (const t of next.tools as unknown[]) {
            const tool = t as { type?: unknown; function?: { name?: unknown; description?: unknown; parameters?: unknown }; needsApproval?: unknown };
            if (
                !tool || typeof tool !== 'object' || tool.type !== 'function'
                || !tool.function || typeof tool.function.name !== 'string' || !TOOL_NAME.test(tool.function.name)
                || (tool.function.description !== undefined && typeof tool.function.description !== 'string')
                || (tool.function.parameters !== undefined && (typeof tool.function.parameters !== 'object' || tool.function.parameters === null))
            ) {
                return { ok: false, message: 'next.tools entries must be { type: "function", function: { name, description?, parameters? }, needsApproval? }' };
            }
            tools.push({
                type: 'function',
                function: {
                    name: tool.function.name,
                    description: (tool.function.description as string | undefined) ?? '',
                    parameters: (tool.function.parameters as Record<string, unknown> | undefined) ?? { type: 'object', properties: {} },
                },
                ...(tool.needsApproval === true ? { needsApproval: true } : {}),
            } as Tool);
        }
        value.tools = tools;
    }
    return { ok: true, value };
}

/**
 * The resumed turn's messages with the override's instructions in place of the
 * paused turn's: the system message that held the old instructions is replaced,
 * or the new instructions lead when there was none.
 */
export function applyInstructionsOverride<M extends { role: string; content: unknown }>(
    messages: M[],
    previous: string | undefined,
    next: string,
): M[] {
    const index = previous
        ? messages.findIndex((m) => m.role === 'system' && m.content === previous)
        : -1;
    if (index >= 0) {
        const copy = messages.slice();
        copy[index] = { ...copy[index], content: next };
        return copy;
    }
    return [{ role: 'system', content: next } as M, ...messages];
}
