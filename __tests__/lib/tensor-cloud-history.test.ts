import { describe, expect, it } from "vitest";
import { cleanHistory } from "@/lib/tensor-cloud-history";

describe("what is kept of a project chat", () => {
  it("keeps the parts the page draws, and only those", () => {
    const kept = cleanHistory([
      { type: "userMessage", id: "u1", content: [{ type: "text", text: "Make it " }, { type: "text", text: "blue" }] },
      { type: "agentMessage", id: "a1", text: "Done." },
      { type: "reasoning", id: "r1", text: "Thinking", seconds: 3.4, startedAt: 123 },
      { type: "commandExecution", id: "c1", command: "npm run build", status: "completed", exitCode: 0, aggregatedOutput: "ok", extra: 1 },
      { type: "fileChange", id: "f1", status: "completed", changes: [{ path: "/data/repo/app.tsx", kind: { type: "update" }, diff: "+a" }] },
      { type: "webSearch", id: "w1" },
      { type: "agentMessage", text: "no id" },
      "nonsense",
    ]);
    expect(kept).toEqual([
      { type: "userMessage", id: "u1", content: [{ type: "text", text: "Make it blue" }] },
      { type: "agentMessage", id: "a1", text: "Done." },
      { type: "reasoning", id: "r1", text: "Thinking", seconds: 3 },
      { type: "commandExecution", id: "c1", command: "npm run build", status: "completed", exitCode: 0, aggregatedOutput: "ok" },
      { type: "fileChange", id: "f1", status: "completed", changes: [{ path: "/data/repo/app.tsx", kind: { type: "update" } }] },
    ]);
  });

  it("keeps the end of a long output, and lets the oldest go when the whole is too large", () => {
    const [command] = cleanHistory([{ type: "commandExecution", id: "c", command: "x", status: "completed", exitCode: 1, aggregatedOutput: `${"a".repeat(5000)}THE END` }]);
    expect((command as { aggregatedOutput: string }).aggregatedOutput.endsWith("THE END")).toBe(true);
    expect((command as { aggregatedOutput: string }).aggregatedOutput.length).toBe(2000);

    const many = Array.from({ length: 100 }, (_, index) => ({ type: "agentMessage", id: `m${index}`, text: "x".repeat(30_000) }));
    const kept = cleanHistory(many);
    expect(JSON.stringify(kept).length).toBeLessThanOrEqual(1_500_000);
    expect(kept.at(-1)?.id).toBe("m99");
    expect(kept[0].id).not.toBe("m0");
  });

  it("is empty for anything that is not a list", () => {
    expect(cleanHistory(null)).toEqual([]);
    expect(cleanHistory({ items: [] })).toEqual([]);
  });
});
