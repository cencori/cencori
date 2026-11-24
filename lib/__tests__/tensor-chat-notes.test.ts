import { describe, expect, it } from "vitest";

import { stripActionNote, withActionNotes } from "../tensor-chats";

describe("action notes", () => {
  const traces = new Map([["a1", [{ type: "action", name: "web_search", status: "done", input: { query: "Bola Banjo" } }]]]) as never;

  it("puts an answer's note on the person's next message, not on the answer", () => {
    const told = withActionNotes(
      [
        { id: "u1", role: "user", content: "Who is Bola?" },
        { id: "a1", role: "assistant", content: "Here is what I found." },
        { id: "u2", role: "user", content: "Thanks" },
      ],
      traces,
      false,
    );
    expect(told[1].content).toBe("Here is what I found.");
    expect(told[2].content).toBe(`Thanks\n\n[Tensor's note, not written by them: in your previous answer you searched the web for "Bola Banjo".]`);
    expect(told[0].content).toBe("Who is Bola?");
  });

  it("takes a note the model wrote itself off the head of its answer", () => {
    expect(stripActionNote(`[In this answer you searched the web for "Bola Banjo".]\n\nWell.`)).toBe("Well.");
    expect(stripActionNote(`[Tensor's note, not written by them: in your previous answer you read a page.]\nHi`)).toBe("Hi");
    expect(stripActionNote("[Link](https://x.com) is here")).toBe("[Link](https://x.com) is here");
    expect(stripActionNote("Plain answer")).toBe("Plain answer");
  });
});
