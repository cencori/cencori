import { describe, expect, it } from "vitest";
import { anyOf, projectScopeKey, snippetOf, sortFacts } from "@/lib/tensor-memory";

describe("Tensor memory", () => {
  it("sorts tagged facts into the person's and the project's", () => {
    const facts = [
      { content: "[you] Prefers pnpm over npm.", importance: 0.8 },
      { content: "[project] The bakery site uses terracotta and cream.", importance: 0.7 },
      { content: "Works in Lagos.", importance: 0.6 },
    ];
    expect(sortFacts(facts, true)).toEqual({
      you: [
        { content: "Prefers pnpm over npm.", importance: 0.8 },
        { content: "Works in Lagos.", importance: 0.6 },
      ],
      project: [{ content: "The bakery site uses terracotta and cream.", importance: 0.7 }],
    });
  });

  it("keeps project facts as the person's in a plain chat", () => {
    const sorted = sortFacts([{ content: "[project] Building a bakery site.", importance: 0.7 }], false);
    expect(sorted.project).toEqual([]);
    expect(sorted.you).toEqual([{ content: "Building a bakery site.", importance: 0.7 }]);
  });

  it("drops a tag with nothing after it", () => {
    expect(sortFacts([{ content: "[you]  ", importance: 0.9 }], true)).toEqual({ you: [], project: [] });
  });

  it("searches any of the meaningful words when all of them find nothing", () => {
    expect(anyOf("What did we decide about the bakery colours?")).toBe("decide or bakery or colours");
    expect(anyOf("the and")).toBe("");
  });

  it("shows the part of a turn around what was searched for", () => {
    const text = `${"intro ".repeat(80)}we picked terracotta for the hero ${"tail ".repeat(80)}`;
    const snippet = snippetOf(text, "terracotta");
    expect(snippet).toContain("terracotta");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(224);
  });

  it("keys a project's facts by its task", () => {
    expect(projectScopeKey("abc")).toBe("tensor-project-abc");
  });
});

describe("Waking a sandbox", () => {
  const fly = (image: string) => {
    const calls: unknown[][] = [];
    return {
      calls,
      get: async (id: string) => {
        calls.push(["get", id]);
        return { ok: true as const, value: { id, state: "stopped", region: "jnb", config: { image, env: { A: "1" } } } };
      },
      update: async (id: string, request: unknown) => {
        calls.push(["update", id, request]);
        return { ok: true as const, value: { id, state: "stopped", region: "jnb" } };
      },
      start: async (id: string) => {
        calls.push(["start", id]);
        return { ok: true as const, value: {} };
      },
    };
  };

  it("moves a machine made from an older image to the current one, then starts it", async () => {
    const { startSandbox } = await import("@/lib/tensor-cloud-tasks");
    const old = fly("registry.fly.io/tensor-sandbox:old");
    await startSandbox(old, "registry.fly.io/tensor-sandbox:new", "m1");
    expect(old.calls).toEqual([
      ["get", "m1"],
      ["update", "m1", { config: { image: "registry.fly.io/tensor-sandbox:new", env: { A: "1" } }, skipLaunch: true }],
      ["start", "m1"],
    ]);
  });

  it("only starts a machine already on the current image", async () => {
    const { startSandbox } = await import("@/lib/tensor-cloud-tasks");
    const current = fly("registry.fly.io/tensor-sandbox:new");
    await startSandbox(current, "registry.fly.io/tensor-sandbox:new", "m1");
    expect(current.calls).toEqual([["get", "m1"], ["start", "m1"]]);
  });
});
