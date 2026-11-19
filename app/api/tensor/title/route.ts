import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { safeProviderFetch } from "@/lib/security/outbound-url";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";

// Names a Tensor chat from its opening exchange, as Copilot names its own (app/api/agent/title):
// a fast model through the Cencori gateway, on Cencori's own key, so it is not counted against the
// person's plan. DeepSeek V4 Flash may think before it answers, so it is given room to (a budget
// of a few words would be spent thinking and return nothing), and any thinking is dropped.
const TITLE_MODEL = "deepseek-v4-flash";
const GATEWAY_BASE_URL = process.env.CENCORI_GATEWAY_URL || "https://api.cencori.com/v1";

const SYSTEM_PROMPT =
  "Write a 2-5 word title for this chat. No quotes, no trailing punctuation, sentence case. Reply with the title only.";

type TitleMessage = { role: "user" | "assistant"; content: string };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);

  const apiKey = process.env.CENCORI_COPILOT_API_KEY;
  if (!apiKey) return json({ error: "Not configured" }, 503);

  const body = (await request.json().catch(() => null)) as { messages?: TitleMessage[] } | null;
  // The opening exchange is enough to name it, and keeps the request tiny.
  const transcript = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(0, 4)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 600)}`)
    .join("\n");
  if (!transcript) return json({ error: "No messages" }, 400);

  try {
    const gateway = new OpenAI({ apiKey, baseURL: GATEWAY_BASE_URL, fetch: safeProviderFetch, timeout: 15_000, maxRetries: 0 });
    const completion = await gateway.chat.completions.create({
      model: TITLE_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      max_tokens: 600,
      temperature: 0.2,
    });
    const title = (completion.choices[0]?.message?.content ?? "")
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim()
      .split("\n")[0]
      .replace(/^["'\s]+|["'.\s]+$/g, "")
      .slice(0, 60);
    if (!title) return json({ error: "Empty title" }, 502);
    return json({ title });
  } catch (error) {
    console.error("[Tensor] Title failed:", error);
    return json({ error: "Title failed" }, 502);
  }
}
