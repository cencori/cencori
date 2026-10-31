import { beforeEach, describe, expect, it, vi } from "vitest";

const ingest = vi.fn(async () => ({ chunks: 1, checksum: "x" }));
vi.mock("@/lib/embedded/agent-knowledge", () => ({ ensureAgentKnowledgeBase: vi.fn(async () => "kb1") }));
vi.mock("@/lib/embedded/knowledge-ingest", () => ({ ingestSourceText: (...args: unknown[]) => ingest(...(args as [])) }));

const { runRememberTool } = await import("@/lib/copilot/remember");

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;

/** Just enough of the Supabase query builder for these tools, over in-memory rows. */
function fakeAdmin() {
    return {
        from(table: string) {
            const filters: Array<[string, unknown]> = [];
            let mode: "select" | "delete" = "select";
            let inserted: Row | null = null;
            const rows = () => (tables[table] ?? []).filter((row) => filters.every(([key, value]) => row[key] === value));
            const builder = {
                select: () => builder,
                eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
                is: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
                order: () => builder,
                limit: () => builder,
                insert: (row: Row) => { inserted = { id: `src${(tables[table] ?? []).length + 1}`, ...row }; (tables[table] ??= []).push(inserted); return builder; },
                delete: () => { mode = "delete"; return builder; },
                single: async () => ({ data: inserted ?? rows()[0] ?? null, error: null }),
                maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
                then: (resolve: (value: { data: Row[]; error: null }) => void) => {
                    if (mode === "delete") { const gone = rows(); tables[table] = (tables[table] ?? []).filter((row) => !gone.includes(row)); }
                    resolve({ data: rows(), error: null });
                },
            };
            return builder;
        },
    };
}

const ctx = () => ({ admin: fakeAdmin() as never, organization: { id: "org", name: "Mama Put", slug: "mama-put" }, project: { id: "proj", name: "Mama Put", slug: "mama-put" }, userId: "owner", business: true });

beforeEach(() => {
    ingest.mockClear();
    tables = {
        organizations: [{ id: "org", owner_id: "owner" }],
        organization_members: [{ organization_id: "org", user_id: "helper", role: "member" }],
        agents: [
            { id: "a1", project_id: "proj", name: "Tolu", is_active: false, stable_version_id: null, created_at: "1" },
            { id: "a2", project_id: "proj", name: "Ada", is_active: true, stable_version_id: "v", created_at: "2" },
        ],
        knowledge_bases: [{ id: "kb1", project_id: "proj", agent_id: "a2", tenant_id: null }],
        knowledge_sources: [],
    };
});

describe("remember", () => {
    it("saves the fact to the main (live) employee straight away, as customers should read it", async () => {
        const result = await runRememberTool("remember", { fact: "We're closed on Sunday 2 November.", title: "Closed Sun 2 Nov" }, ctx()) as { saved: boolean; remembered: Record<string, string> };
        expect(result.saved).toBe(true);
        expect(result.remembered).toMatchObject({ fact: "We're closed on Sunday 2 November.", agent_id: "a2", agent_name: "Ada" });
        const source = tables.knowledge_sources[0];
        expect(source.metadata).toMatchObject({ name: "From you: Closed Sun 2 Nov", from_owner: true, fact: "We're closed on Sunday 2 November." });
        expect(ingest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceId: source.id, text: expect.stringMatching(/^From the owner \(\d{4}-\d{2}-\d{2}\): We're closed on Sunday 2 November\.$/) }));
    });

    it("saves to the named employee when told to", async () => {
        const result = await runRememberTool("remember", { fact: "Parking is behind the building.", title: "Parking", staff: "tolu" }, ctx()) as { remembered: Record<string, string> };
        expect(result.remembered.agent_name).toBe("Tolu");
        expect(await runRememberTool("remember", { fact: "x", title: "x", staff: "Bisi" }, ctx())).toEqual({ error: 'No one on the staff is called "Bisi". The staff: Tolu, Ada.' });
    });

    it("is for the owner and admins only, and needs an employee to exist", async () => {
        expect(await runRememberTool("remember", { fact: "x", title: "x" }, { ...ctx(), userId: "helper" })).toEqual({ error: "Only the business's owner or admins can change what the employee tells customers." });
        tables.agents = [];
        expect(await runRememberTool("remember", { fact: "x", title: "x" }, ctx())).toMatchObject({ error: expect.stringContaining("no employee set up yet") });
    });
});

describe("forget", () => {
    beforeEach(async () => {
        await runRememberTool("remember", { fact: "We're closed on Sunday 2 November.", title: "Closed Sun 2 Nov" }, ctx());
        await runRememberTool("remember", { fact: "Suya is ₦4,000 a stick now.", title: "Suya price" }, ctx());
    });

    it("finds what the owner said by what it was about and removes just that", async () => {
        expect(await runRememberTool("forget", { about: "suya" }, ctx())).toMatchObject({ forgotten: true, fact: "Suya is ₦4,000 a stick now." });
        expect(tables.knowledge_sources.map((source) => (source.metadata as { title: string }).title)).toEqual(["Closed Sun 2 Nov"]);
    });

    it("asks which when more than one matches, and says what it knows when nothing does", async () => {
        await runRememberTool("remember", { fact: "Sunday brunch starts at 11am.", title: "Sunday brunch" }, ctx());
        expect(await runRememberTool("forget", { about: "sunday" }, ctx())).toMatchObject({ error: "More than one thing matches; ask which." });
        expect(await runRememberTool("forget", { about: "parking" }, ctx())).toMatchObject({ error: expect.stringContaining("Closed Sun 2 Nov") });
    });
});
