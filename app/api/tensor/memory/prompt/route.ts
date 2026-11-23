import { NextRequest } from "next/server";
import { promptContext } from "@/lib/tensor-memory";
import { memoryCaller, memoryJson, text, threadPlace } from "@/lib/tensor-memory-request";

/**
 * What Tensor remembers that bears on a message, asked for as the message is sent (the sandbox's
 * memory hook, before the agent reads it). On a chat's first message, also the most important of
 * what is known about the person and the project, and earlier chats about the same thing.
 *
 * Body: `{ threadId, prompt, first, known }`, `known` being the ids already given in this chat.
 * Answers `{ context, ids }`; `context` is empty when there is nothing to say.
 */
export async function POST(request: NextRequest) {
  const caller = await memoryCaller(request.headers.get("authorization"));
  if (!caller) return memoryJson({ error: "Not signed in." }, 401);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return memoryJson({ error: "That request is invalid." }, 400);
  }
  const prompt = text(body.prompt, 4000);
  if (!prompt) return memoryJson({ context: "", ids: [] });
  const known = Array.isArray(body.known) ? body.known.filter((id): id is string => typeof id === "string").slice(0, 500) : [];
  try {
    const result = await promptContext(caller.admin, {
      userId: caller.userId,
      taskId: caller.taskId,
      prompt,
      first: body.first === true,
      known,
      place: threadPlace(caller, body.threadId),
    });
    return memoryJson(result);
  } catch (error) {
    console.error("[Tensor Memory] Building a message's context failed", error);
    return memoryJson({ context: "", ids: [] });
  }
}
