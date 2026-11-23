import { NextRequest } from "next/server";
import { readChat, recallFacts, rememberFact, searchChats } from "@/lib/tensor-memory";
import { memoryCaller, memoryJson, text, threadPlace } from "@/lib/tensor-memory-request";

/**
 * The agent's memory tools (the sandbox's memory MCP server): remember, recall, search_chats and
 * read_chat. Body: `{ tool, input, threadId }`. Answers the tool's result as JSON, or `{ error }`.
 */
export async function POST(request: NextRequest) {
  const caller = await memoryCaller(request.headers.get("authorization"));
  if (!caller) return memoryJson({ error: "Not signed in." }, 401);
  let body: { tool?: unknown; input?: Record<string, unknown>; threadId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return memoryJson({ error: "That request is invalid." }, 400);
  }
  const input = body.input && typeof body.input === "object" ? body.input : {};
  const { admin, userId, taskId } = caller;

  try {
    switch (body.tool) {
      case "remember": {
        const about = input.about === "project" ? "project" : "you";
        const result = await rememberFact(admin, { userId, taskId, about, content: text(input.fact, 2000) });
        return memoryJson(result.ok ? { saved: true, about } : { error: result.error });
      }
      case "recall": {
        const query = text(input.query, 1000);
        if (!query) return memoryJson({ error: "Say what to recall." });
        const facts = await recallFacts(admin, { userId, taskId, query, pinned: false });
        return memoryJson({ facts: facts.map((fact) => ({ about: fact.about, fact: fact.content })) });
      }
      case "search_chats": {
        const query = text(input.query, 300);
        if (!query) return memoryJson({ error: "Say what to search for." });
        const chats = await searchChats(admin, {
          userId,
          query,
          limit: Math.min(Math.max(Number(input.limit) || 6, 1), 12),
          exclude: threadPlace(caller, body.threadId),
        });
        return memoryJson({ chats });
      }
      case "read_chat": {
        const chat = await readChat(admin, { userId, chatId: text(input.chat_id, 64), turns: Number(input.turns) || undefined });
        return memoryJson(chat ?? { error: "No chat of theirs has that id." });
      }
      default:
        return memoryJson({ error: "There is no such memory tool." }, 400);
    }
  } catch (error) {
    console.error("[Tensor Memory] A memory tool failed", error);
    return memoryJson({ error: "Memory could not be reached just now." });
  }
}
