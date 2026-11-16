import { describe, expect, it } from "vitest";
import { contextMessages, isUuid, plainChatInstructions, titleFromMessage } from "@/lib/tensor-chats";

describe("plain chats", () => {
  it("names a chat from the first line of its first message", () => {
    expect(titleFromMessage("  Help me plan a bakery site\nwith a menu")).toBe("Help me plan a bakery site");
    expect(titleFromMessage("")).toBe("New chat");
    const long = titleFromMessage("a".repeat(100));
    expect(long.length).toBeLessThanOrEqual(58);
    expect(long.endsWith("…")).toBe(true);
  });

  it("sends the newest messages, starting with the person", () => {
    const messages = [
      { role: "user" as const, content: "one", status: "complete" as const },
      { role: "assistant" as const, content: "two", status: "complete" as const },
      { role: "user" as const, content: "three", status: "complete" as const },
    ];
    expect(contextMessages(messages).map((message) => message.content)).toEqual(["one", "two", "three"]);
    // A conversation cut so that it would open with an answer drops that answer.
    expect(contextMessages(messages.slice(1)).map((message) => message.content)).toEqual(["three"]);
  });

  it("skips empty answers, such as one stopped before it began", () => {
    const messages = [
      { role: "user" as const, content: "hi", status: "complete" as const },
      { role: "assistant" as const, content: "", status: "stopped" as const },
      { role: "user" as const, content: "again", status: "complete" as const },
    ];
    expect(contextMessages(messages).map((message) => message.content)).toEqual(["hi", "again"]);
  });

  it("tells Tensor the person's projects and that building happens in one", () => {
    const text = plainChatInstructions([{ name: "Bakery", published: true }], new Date("2026-11-16T00:00:00Z"));
    expect(text).toContain("- Bakery (published)");
    expect(text).toContain("plain chat");
    expect(text).toContain("2026-11-16");
    expect(plainChatInstructions([], new Date())).toContain("None yet.");
  });

  it("only accepts real ids", () => {
    expect(isUuid("76c33eff-f412-44ae-98b1-4ce0cdc3656b")).toBe(true);
    expect(isUuid("not-an-id")).toBe(false);
  });
});
