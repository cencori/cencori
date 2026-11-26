import "server-only";

import { callMemoryLlm } from "@/lib/memory/llm";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import type { BackgroundWork } from "@/lib/tensor-background-turn";
import { memoryHome } from "@/lib/tensor-memory";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * What Tensor says when a message has to wait for work it already has in hand: written by a
 * model each time, in reply to what the person actually said ("got it, one moment", "sure, on it
 * once I've finished the footer"), never a fixed line. Uses the small, fast model Tensor's memory
 * uses (lib/memory/llm.ts), on Tensor's own Cencori project: a fraction of a cent, paid by us.
 * Null when it cannot be had quickly; the page then says something plain itself.
 */

const SYSTEM = `You are Tensor, an AI that builds and changes software for the person you are talking to. They just sent you a message, but you are still in the middle of other work for them, so their message will wait and you will get to it as soon as you finish.

Reply with ONE short line (at most 20 words) answering what they actually said, the way a friendly, competent teammate would on chat: a greeting gets a greeting, a request gets an acknowledgement, a question gets "I'll look into it". Make it sound like you, in the moment, not a stock phrase. Match their tone: casual if they are casual, brief if they are brief. You may say what you are finishing, in a few words, if it helps; never quote it word for word. Do not answer or start on their request, do not promise a time, do not apologise, no emoji unless they used one. Output only the line.`;

function describe(work: BackgroundWork | null, project: string | null): string {
  if (!work) return "You are finishing a turn in another chat.";
  const where = work.taskId === project ? "this project" : `another project${work.title ? ` (${work.title})` : ""}`;
  if (work.source === "quality" && work.asked.length) {
    return `You are finishing changes in ${where} that they asked for in comments on its published site: ${work.asked
      .map((asked) => `"${asked.replace(/\s+/g, " ").slice(0, 160)}"`)
      .join("; ")}.`;
  }
  return `You are finishing work in ${where}.`;
}

export async function busyWords(
  admin: Admin,
  input: { message: string; work: BackgroundWork | null; project: string | null },
): Promise<string | null> {
  const place = await memoryHome(admin);
  if (!place) return null;
  try {
    const result = await Promise.race([
      callMemoryLlm({
        maxTokens: 400,
        messages: [
          { content: SYSTEM, role: "system" },
          {
            content: `${describe(input.work, input.project)}\n\nTheir message:\n${input.message.slice(0, 2000)}`,
            role: "user",
          },
        ],
        organizationId: place.organizationId,
        projectId: place.projectId,
        supabase: admin,
        temperature: 0.9,
        tier: "enterprise",
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6_000)),
    ]);
    const line = result?.content
      ?.split("\n")
      .map((part) => part.trim().replace(/^["'“]+|["'”]+$/g, "").trim())
      .find(Boolean);
    return line && line.length <= 200 ? line : null;
  } catch {
    return null;
  }
}
