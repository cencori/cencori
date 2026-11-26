import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const call = vi.fn();
vi.mock("@/lib/memory/llm", () => ({ callMemoryLlm: (params: unknown) => call(params) }));
vi.mock("@/lib/tensor-memory", () => ({
  memoryHome: vi.fn(async () => ({ organizationId: "org", projectId: "proj", settings: {} })),
}));

import { busyWords } from "@/lib/tensor-busy-words";

const work = { asked: ["Center this."], source: "quality", startedAt: null, taskId: "task-1", title: "Bakery" };

describe("What Tensor says to a message that has to wait", () => {
  beforeEach(() => call.mockReset());

  it("is the model's own line, in reply to what was said, told what Tensor is finishing", async () => {
    call.mockResolvedValue({ content: '"Sure, right after the footer fix."\n' });
    const said = await busyWords({} as never, { message: "can you add a dark mode", project: "task-1", work });
    expect(said).toBe("Sure, right after the footer fix.");
    const asked = call.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> };
    expect(asked.messages[1].content).toContain('comments on its published site: "Center this."');
    expect(asked.messages[1].content).toContain("this project");
    expect(asked.messages[1].content).toContain("can you add a dark mode");
  });

  it("is nothing (the page says something plain) when the model fails or rambles", async () => {
    call.mockRejectedValue(new Error("down"));
    expect(await busyWords({} as never, { message: "hi", project: null, work: null })).toBeNull();
    call.mockResolvedValue({ content: "x".repeat(400) });
    expect(await busyWords({} as never, { message: "hi", project: null, work: null })).toBeNull();
  });
});
