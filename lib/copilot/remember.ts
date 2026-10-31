import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import { ensureAgentKnowledgeBase } from "@/lib/embedded/agent-knowledge";
import { ingestSourceText } from "@/lib/embedded/knowledge-ingest";
import type { CopilotToolContext } from "@/lib/copilot/tools";

/**
 * "Tell it once and it remembers" (Studio, business accounts): what the owner
 * tells their employee about the business goes straight into what it tells
 * customers. No confirmation card: each fact is its own knowledge document
 * ("From you: …", metadata.from_owner), live on the next customer message
 * (knowledge isn't versioned), and the chat shows it with an Undo that deletes
 * that one document. forget finds a fact by what it was about, since the model
 * doesn't keep tool results from earlier turns.
 */

export const REMEMBER_TOOLS: ChatCompletionFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "remember",
            description: "Save something the owner told you about the business, so you tell customers from now on: hours, closures, prices that aren't in the catalog, policies, where to park, what's on this week. Saved straight away (no confirmation) and used on the next customer message. Write the fact the way a customer should hear it, complete on its own (\"We're closed on Sunday 2 November.\", not \"closed sunday\"). One fact per call. Not for how you behave (tone, standing rules: that's update_agent_instructions) and not for private things the owner doesn't want customers to know.",
            parameters: {
                type: "object",
                properties: {
                    fact: { type: "string", description: "The fact, as customers should hear it." },
                    title: { type: "string", description: "A few words naming it, e.g. \"Closed Sunday 2 Nov\"." },
                    staff: { type: "string", description: "Which employee should know, by name, when the business has more than one. Defaults to the main one." },
                },
                required: ["fact", "title"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "forget",
            description: "Stop telling customers something the owner told you before (\"forget what I said about Sunday\", \"that's not true any more\"). Finds it by what it was about among the facts the owner gave you. Done straight away.",
            parameters: {
                type: "object",
                properties: {
                    about: { type: "string", description: "Words from the fact or its title, e.g. \"Sunday\"." },
                    staff: { type: "string", description: "Which employee, by name, when there's more than one." },
                },
                required: ["about"],
            },
        },
    },
];

export const REMEMBER_TOOL_NAMES = new Set(REMEMBER_TOOLS.map((tool) => tool.function.name));

export const REMEMBER_TOOL_STATUS: Record<string, string> = {
    remember: "Making a note",
    forget: "Crossing it out",
};

type Agent = { id: string; name: string };
type OwnerNote = { id: string; title: string; fact: string };

/** The employee it's for: the one named, else the main one (the oldest live one, as the AI tab shows it). */
async function staffMember(ctx: CopilotToolContext, name: unknown): Promise<Agent | { error: string }> {
    const { data } = await ctx.admin.from("agents").select("id, name, is_active, stable_version_id, created_at").eq("project_id", ctx.project!.id).order("created_at", { ascending: true });
    const staff = (data ?? []) as Array<Agent & { is_active: boolean; stable_version_id: string | null }>;
    if (!staff.length) return { error: "There's no employee set up yet, so there's nowhere to keep that. Set one up first (create_agent)." };
    if (typeof name === "string" && name.trim()) {
        const wanted = name.trim().toLowerCase();
        const match = staff.find((agent) => agent.name.toLowerCase() === wanted) ?? staff.find((agent) => agent.name.toLowerCase().includes(wanted));
        if (!match) return { error: `No one on the staff is called "${name}". The staff: ${staff.map((agent) => agent.name).join(", ")}.` };
        return { id: match.id, name: match.name };
    }
    const main = staff.find((agent) => agent.is_active && agent.stable_version_id) ?? staff[0];
    return { id: main.id, name: main.name };
}

/** Only an organization's owner or admins change what an employee knows, as on the knowledge route. */
async function canManage(ctx: CopilotToolContext): Promise<boolean> {
    if (!ctx.userId) return false;
    const { data: organization } = await ctx.admin.from("organizations").select("owner_id").eq("id", ctx.organization.id).maybeSingle();
    if ((organization as { owner_id?: string } | null)?.owner_id === ctx.userId) return true;
    const { data: membership } = await ctx.admin.from("organization_members").select("role").eq("organization_id", ctx.organization.id).eq("user_id", ctx.userId).maybeSingle();
    return ["owner", "admin"].includes(((membership as { role?: string } | null)?.role) ?? "");
}

async function ownerNotes(ctx: CopilotToolContext, agent: Agent): Promise<{ knowledgeBaseId: string | null; notes: OwnerNote[] }> {
    const { data: kb } = await ctx.admin.from("knowledge_bases").select("id").eq("project_id", ctx.project!.id).eq("agent_id", agent.id).is("tenant_id", null).maybeSingle();
    if (!kb) return { knowledgeBaseId: null, notes: [] };
    const { data } = await ctx.admin.from("knowledge_sources").select("id, metadata").eq("knowledge_base_id", (kb as { id: string }).id).order("created_at", { ascending: false }).limit(500);
    const notes = ((data ?? []) as Array<{ id: string; metadata: { from_owner?: boolean; title?: string; fact?: string } | null }>)
        .filter((row) => row.metadata?.from_owner)
        .map((row) => ({ id: row.id, title: row.metadata?.title ?? "", fact: row.metadata?.fact ?? "" }));
    return { knowledgeBaseId: (kb as { id: string }).id, notes };
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

export type Remembered = { id: string; fact: string; agent_id: string; agent_name: string };

export async function runRememberTool(name: string, args: Record<string, unknown>, ctx: CopilotToolContext): Promise<unknown> {
    if (!ctx.project) return { error: "No business is selected." };
    if (!await canManage(ctx)) return { error: "Only the business's owner or admins can change what the employee tells customers." };
    const agent = await staffMember(ctx, args.staff);
    if ("error" in agent) return agent;

    if (name === "remember") {
        const fact = clean(args.fact, 2_000);
        const title = clean(args.title, 80) || fact.slice(0, 60);
        if (!fact) return { error: "Say the fact to remember." };
        const knowledgeBaseId = await ensureAgentKnowledgeBase(ctx.admin, { projectId: ctx.project.id, agentId: agent.id, agentName: agent.name });
        const today = new Date().toISOString().slice(0, 10);
        // The document reads as the owner's word, dated, so an answer can lean on it.
        const text = `From the owner (${today}): ${fact}`;
        const { data: source, error } = await ctx.admin
            .from("knowledge_sources")
            .insert({ knowledge_base_id: knowledgeBaseId, source_type: "inline", mime: "text/plain", bytes: Buffer.byteLength(text), status: "queued", metadata: { name: `From you: ${title}`, filename: `From you: ${title}`, from_owner: true, title, fact, told_at: today }, content_ref: null })
            .select("id")
            .single();
        if (error || !source) return { error: "Couldn't save that just now." };
        const sourceId = (source as { id: string }).id;
        try {
            await ingestSourceText(ctx.admin, { projectId: ctx.project.id, organizationId: ctx.organization.id, knowledgeBaseId, tenantId: null, sourceId, text });
        } catch {
            await ctx.admin.from("knowledge_sources").delete().eq("id", sourceId);
            return { error: "Couldn't save that just now." };
        }
        const remembered: Remembered = { id: sourceId, fact, agent_id: agent.id, agent_name: agent.name };
        return { saved: true, remembered, note: `${agent.name} tells customers this from their next message. The owner can undo it from the chat.` };
    }

    if (name === "forget") {
        const about = clean(args.about, 200).toLowerCase();
        if (!about) return { error: "Say what to forget." };
        const { knowledgeBaseId, notes } = await ownerNotes(ctx, agent);
        const words = about.split(" ").filter((word) => word.length > 2);
        const matches = notes.filter((note) => {
            const hay = `${note.title} ${note.fact}`.toLowerCase();
            return hay.includes(about) || (words.length > 0 && words.every((word) => hay.includes(word)));
        });
        if (!knowledgeBaseId || matches.length === 0) {
            return { error: notes.length ? `Nothing the owner told ${agent.name} matches "${args.about}". What they told it: ${notes.slice(0, 15).map((note) => note.title).join("; ")}.` : `The owner hasn't told ${agent.name} anything to forget yet.` };
        }
        if (matches.length > 1) return { error: "More than one thing matches; ask which.", matches: matches.slice(0, 10).map((note) => ({ title: note.title, fact: note.fact })) };
        await ctx.admin.from("knowledge_sources").delete().eq("id", matches[0].id).eq("knowledge_base_id", knowledgeBaseId);
        return { forgotten: true, fact: matches[0].fact, note: `${agent.name} no longer tells customers this.` };
    }

    return { error: `Unknown tool ${name}.` };
}
