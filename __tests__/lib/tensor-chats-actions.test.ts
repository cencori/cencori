import { describe, expect, it } from "vitest";
import { actionNote } from "@/lib/tensor-chats";

describe("what an answer did, as the model reads it next time", () => {
  const proposal = { type: "action" as const, name: "propose_project" as const, status: "done" as const, input: { name: "Photography Portfolio", brief: "…" } };

  it("says a project was proposed, and whether it was created", () => {
    expect(actionNote([proposal], false)).toBe(
      '[In this answer you proposed the project "Photography Portfolio" (a card with a Create project button was shown under your answer).]',
    );
    expect(actionNote([proposal], true)).toContain("the person has since created it");
  });

  it("lists searches too, and says nothing for an answer that did nothing", () => {
    expect(actionNote([{ type: "action", name: "web_search", status: "done", input: { query: "lightbox libraries" } }], false)).toBe(
      '[In this answer you searched the web for "lightbox libraries".]',
    );
    expect(actionNote([{ type: "text", text: "hi" }], false)).toBeNull();
    expect(actionNote(undefined, false)).toBeNull();
    expect(actionNote([{ ...proposal, status: "failed" }], false)).toBeNull();
  });
});
