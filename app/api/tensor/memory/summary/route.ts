import { NextRequest } from "next/server";
import { answerMemoryNote, memorySummary } from "@/lib/tensor-memory";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { memoryJson, text } from "@/lib/tensor-memory-request";

/**
 * The memory summary in Settings, Memory on the web:
 *
 *   GET   the summary of what Tensor knows about the person, written again first when the facts
 *         under it have changed
 *   POST  `{ text }` a note from them: a question about their memory, or a change to make. Answers
 *         `{ reply, summary }`
 */
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const signedIn = await authenticateTensorDataRequest(request.headers.get("authorization"));
  if (!signedIn) return memoryJson({ error: "Your Cencori session is invalid." }, 401);
  try {
    return memoryJson(await memorySummary(signedIn.admin, signedIn.user.id));
  } catch (error) {
    console.error("[Tensor Memory] Reading the summary failed", error);
    return memoryJson({ error: "Tensor could not read its memory just now." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const signedIn = await authenticateTensorDataRequest(request.headers.get("authorization"));
  if (!signedIn) return memoryJson({ error: "Your Cencori session is invalid." }, 401);
  let note = "";
  try {
    note = text(((await request.json()) as { text?: unknown }).text, 2000);
  } catch {
    return memoryJson({ error: "That request is invalid." }, 400);
  }
  try {
    const result = await answerMemoryNote(signedIn.admin, signedIn.user.id, note);
    return result.ok ? memoryJson({ reply: result.reply, summary: result.summary }) : memoryJson({ error: result.error }, 400);
  } catch (error) {
    console.error("[Tensor Memory] Answering a note failed", error);
    return memoryJson({ error: "Tensor could not do that just now." }, 503);
  }
}
