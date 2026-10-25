import { describe, expect, it } from "vitest";
import { HELPER_MAX_TOKENS, HELPER_MODEL, helperBody } from "../tensor-helpers";

const ask = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ messages: [{ role: "user", content: "Suggest a next prompt." }], ...extra });

describe("helper calls", () => {
  it("runs on the helper model with a short answer, whatever the client asked for", () => {
    const body = JSON.parse(
      helperBody(ask({ model: "claude-opus-5-5", max_tokens: 8000, stream: true }), "user-1") ?? "{}",
    );
    expect(body).toEqual({
      model: HELPER_MODEL,
      messages: [{ role: "user", content: "Suggest a next prompt." }],
      max_tokens: HELPER_MAX_TOKENS,
      stream: false,
      user: "user-1",
    });
  });

  it("keeps the whole budget even when less is asked for, so thinking cannot leave no answer", () => {
    expect(JSON.parse(helperBody(ask({ max_tokens: 40 }), "u") ?? "{}").max_tokens).toBe(HELPER_MAX_TOKENS);
  });

  it("drops tools, tool choice and anything else a turn would carry", () => {
    const body = JSON.parse(
      helperBody(
        ask({ tools: [{ type: "function" }], tool_choice: "auto", reasoning_effort: "high" }),
        "u",
      ) ?? "{}",
    );
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "stream", "user"]);
  });

  it("refuses what is not a plain chat request", () => {
    expect(helperBody("not json", "u")).toBeNull();
    expect(helperBody(JSON.stringify({ messages: [] }), "u")).toBeNull();
    expect(helperBody(JSON.stringify({ messages: [{ role: "tool", content: "x" }] }), "u")).toBeNull();
    expect(
      helperBody(JSON.stringify({ messages: [{ role: "user", content: [{ type: "image_url" }] }] }), "u"),
    ).toBeNull();
    expect(
      helperBody(
        JSON.stringify({ messages: Array.from({ length: 13 }, () => ({ role: "user", content: "x" })) }),
        "u",
      ),
    ).toBeNull();
  });
});
