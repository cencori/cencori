import { describe, expect, it } from "vitest";
import { readStream, searchQuery } from "@/lib/tensor-chats-stream";

function sse(chunks: unknown[]): ReadableStream<Uint8Array> {
  const text = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  const bytes = new TextEncoder().encode(text);
  // Split mid-line, as a network would.
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, 37));
      controller.enqueue(bytes.slice(37));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of readStream(body, new AbortController().signal)) events.push(event);
  return events;
}

describe("reading a plain chat's stream", () => {
  it("passes the words through as they come", async () => {
    const events = await collect(sse([{ choices: [{ delta: { content: "Hel" } }] }, { choices: [{ delta: { content: "lo" } }] }]));
    expect(events).toEqual([
      { kind: "text", text: "Hel" },
      { kind: "text", text: "lo" },
    ]);
  });

  it("puts a search together whether it arrives whole or in pieces", async () => {
    const whole = await collect(
      sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "a", type: "function", function: { name: "web_search", arguments: '{"query":"naira rate"}' } }] } }] }]),
    );
    expect(whole).toEqual([{ kind: "call", call: { id: "a", type: "function", function: { name: "web_search", arguments: '{"query":"naira rate"}' } } }]);

    const pieces = await collect(
      sse([
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "b", function: { name: "web_search", arguments: '{"que' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"lagos weather"}' } }] } }] },
      ]),
    );
    expect(pieces).toHaveLength(1);
    expect(searchQuery((pieces[0] as { call: Parameters<typeof searchQuery>[0] }).call)).toBe("lagos weather");
  });

  it("stops at an error the stream reports", async () => {
    await expect(collect(sse([{ error: { message: "boom" } }]))).rejects.toThrow("boom");
  });

  it("only reads searches it knows, with a query", () => {
    const call = (name: string, args: string) => ({ id: "x", type: "function" as const, function: { name, arguments: args } });
    expect(searchQuery(call("web_search", '{"query":"  x  "}'))).toBe("x");
    expect(searchQuery(call("web_search", "{}"))).toBeNull();
    expect(searchQuery(call("web_search", "not json"))).toBeNull();
    expect(searchQuery(call("delete_files", '{"query":"x"}'))).toBeNull();
  });
});
