import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { learnFromTurn, recordTurn } from "@/lib/tensor-memory";
import { memoryCaller, memoryJson, text, threadPlace } from "@/lib/tensor-memory-request";

/**
 * A finished turn, reported by the sandbox's memory hook: kept so other chats can find it, and
 * read for facts worth remembering. Answers at once; the reading happens after.
 *
 * Body: `{ threadId, turnId, prompt, answer }`.
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
  const place = threadPlace(caller, body.threadId);
  const turnId = text(body.turnId, 120);
  const prompt = text(body.prompt, 20_000);
  const answer = text(body.answer, 60_000);
  if (!place || place.kind !== "project" || !turnId || !prompt || !answer) return memoryJson({ kept: false });

  const kept = await recordTurn(caller.admin, {
    userId: caller.userId,
    place,
    turnKey: `project:${place.taskId}:${place.threadId}:${turnId}`,
    prompt,
    answer,
  });
  if (kept) {
    waitUntil(
      learnFromTurn(caller.admin, { userId: caller.userId, taskId: place.taskId, prompt, answer, source: "project-chat" }),
    );
  }
  return memoryJson({ kept });
}
