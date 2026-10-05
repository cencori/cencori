import { NextResponse } from "next/server";
import {
  TENSOR_WAITLIST_FIELD_ORDER,
  TENSOR_WAITLIST_LABELS,
  TENSOR_WAITLIST_OPTIONS,
  emptyTensorWaitlist,
  nextMissingField,
  scriptedPromptFor,
  validateTensorField,
  type TensorWaitlistFieldKey,
  type TensorWaitlistFields,
} from "@/lib/tensor-waitlist";
import { generateWithFallback } from "@/lib/scan/ai-client";

type ChatMsg = { role: "user" | "assistant"; content: string };

type AgentRequest = {
  messages: ChatMsg[];
  collected: Partial<TensorWaitlistFields>;
  currentField?: TensorWaitlistFieldKey | null;
};

function sanitizeCollected(input: Partial<TensorWaitlistFields>): TensorWaitlistFields {
  const base = emptyTensorWaitlist();
  for (const key of TENSOR_WAITLIST_FIELD_ORDER) {
    const v = (input as Record<string, unknown>)[key];
    if (Array.isArray(v)) base[key] = v.map(String).slice(0, 12) as never;
    else if (typeof v === "string") base[key] = v.slice(0, 2000) as never;
  }
  return base;
}

function buildPrompt(messages: ChatMsg[], collected: TensorWaitlistFields, currentField: TensorWaitlistFieldKey | null) {
  const history = messages.slice(-10).map((m) => `${m.role === "user" ? "User" : "Tensor"}: ${m.content}`).join("\n");
  const filled = TENSOR_WAITLIST_FIELD_ORDER.map(
    (k) => `- ${k} (${TENSOR_WAITLIST_LABELS[k]}): ${Array.isArray(collected[k]) ? (collected[k] as string[]).join(", ") || "(empty)" : (collected[k] as string) || "(empty)"}${TENSOR_WAITLIST_OPTIONS[k] ? ` [options: ${TENSOR_WAITLIST_OPTIONS[k]!.join(" | ")}]` : ""}`,
  ).join("\n");

  return `You are Tensor, the onboarding agent for the Tensor waitlist (an agentic dev environment by Cencori). You are collecting waitlist details conversationally, one field at a time.

CURRENT FIELD TO FILL: ${currentField ?? "(all filled — confirm and close)"}

COLLECTED SO FAR:
${filled}

RECENT HISTORY:
${history || "(none)"}

Rules:
- The user's LAST message answers CURRENT FIELD (unless they clearly correct an earlier field like "actually my email is X" — then update that field instead).
- Accept natural answers: "none", "skip", "other: windsurf + zed", comma lists for multi-select.
- For email: only accept valid emails. If invalid, ask again briefly.
- For option fields: map fuzzy matches to the exact option string (e.g. "asap" -> "Immediately", "copilot" -> "GitHub Copilot"). Keep custom "Other" text as-is.
- Reply in Tensor voice: short (1-2 sentences), warm, confident, no emojis. Acknowledge what they said, then ask the next question naturally. Never list all remaining questions.
- If everything except anythingElse is filled, give a 1-sentence recap + ask "Anything else you want us to know? (you can say skip)".
- If user says skip on anythingElse, treat as done.

Return STRICT JSON only, no markdown fences, with this shape:
{"reply":"...","updates":{"<field>":"value or array"},"nextField":"<field|null>","done":false}

nextField = the next empty required field after applying updates, or "anythingElse" if only that remains, or null when done (all required filled AND anythingElse asked).
done = true only when nextField is null.`;
}

function tryParseAgentJson(text: string): { reply: string; updates: Record<string, unknown>; nextField: string | null; done: boolean } | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      reply?: unknown;
      updates?: unknown;
      nextField?: unknown;
      done?: unknown;
    };
    if (typeof parsed.reply !== "string") return null;
    return {
      reply: parsed.reply.slice(0, 600),
      updates: (parsed.updates as Record<string, unknown>) || {},
      nextField: typeof parsed.nextField === "string" ? parsed.nextField : parsed.nextField === null ? null : undefined as unknown as string | null,
      done: parsed.done === true,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages: ChatMsg[] = Array.isArray(body.messages)
    ? body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-20)
    : [];
  const collected = sanitizeCollected(body.collected || {});
  const currentField: TensorWaitlistFieldKey | null =
    body.currentField && TENSOR_WAITLIST_FIELD_ORDER.includes(body.currentField) ? body.currentField : nextMissingField(collected);

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "";

  // Fast path: no user message yet (chat opened) — ask first missing field without LLM.
  if (!lastUser) {
    const first = currentField ?? "anythingElse";
    return NextResponse.json({
      reply: scriptedPromptFor(first as TensorWaitlistFieldKey),
      collected,
      currentField: first,
      done: false,
      provider: "scripted",
    });
  }

  // Try LLM for natural parsing + reply.
  try {
    const result = await generateWithFallback(buildPrompt(messages, collected, currentField));
    if (result?.text) {
      const parsed = tryParseAgentJson(result.text);
      if (parsed) {
        const next: TensorWaitlistFields = { ...collected };
        // Apply + validate LLM updates.
        for (const [k, v] of Object.entries(parsed.updates)) {
          if (!TENSOR_WAITLIST_FIELD_ORDER.includes(k as TensorWaitlistFieldKey)) continue;
          const key = k as TensorWaitlistFieldKey;
          const raw = Array.isArray(v) ? (v as unknown[]).map(String).join(", ") : String(v ?? "");
          const check = validateTensorField(key, raw, next);
          if (check.ok) {
            (next as Record<string, unknown>)[key] = check.normalized;
          }
        }
        // Recompute truth from validation (LLM can be optimistic).
        let computed = nextMissingField(next) as TensorWaitlistFieldKey | null;
        // If LLM says a specific next field and it's actually empty, honor it (keeps order stable).
        if (parsed.nextField && TENSOR_WAITLIST_FIELD_ORDER.includes(parsed.nextField as TensorWaitlistFieldKey)) {
          const want = parsed.nextField as TensorWaitlistFieldKey;
          const val = next[want];
          const empty = Array.isArray(val) ? val.length === 0 : val.trim() === "";
          // anythingElse is optional: only honor if required fields are done.
          if (want === "anythingElse") {
            computed = computed === null ? "anythingElse" : computed;
          } else if (empty) {
            computed = want;
          }
        } else if (parsed.nextField === null) {
          computed = computed === null ? null : computed;
        }
        // done only when required fields complete and agent confirms.
        const done = computed === null && parsed.done === true;
        // If required done but anythingElse never asked, force one more turn.
        const askedAnything = messages.some(
          (m) => m.role === "assistant" && /anything else/i.test(m.content),
        );
        if (computed === null && !askedAnything && !done) {
          computed = "anythingElse";
        }
        if (computed === null && askedAnything && /^\s*(skip|no|nope|nothing|n\/a|na)\s*$/i.test(lastUser)) {
          return NextResponse.json({
            reply: parsed.reply || "Perfect — you're in. Submitting your spot now.",
            collected: next,
            currentField: null,
            done: true,
            provider: result.provider,
          });
        }
        return NextResponse.json({
          reply: parsed.reply,
          collected: next,
          currentField: computed,
          done,
          provider: result.provider,
        });
      }
    }
  } catch (err) {
    console.warn("[tensor-waitlist-agent] LLM failed, using rule fallback:", err instanceof Error ? err.message : err);
  }

  // Rule-based fallback: assign last message to current field.
  if (!currentField) {
    return NextResponse.json({
      reply: "You're all set — submitting your spot now.",
      collected,
      currentField: null,
      done: true,
      provider: "fallback",
    });
  }
  const check = validateTensorField(currentField, lastUser, collected);
  if (!check.ok) {
    const retry =
      currentField === "workEmail"
        ? "Hmm, that doesn't look like a valid work email — mind double-checking it?"
        : "Got it — could you say that a little differently so I capture it right?";
    return NextResponse.json({ reply: retry, collected, currentField, done: false, provider: "fallback" });
  }
  const next = { ...collected, [currentField]: check.normalized } as TensorWaitlistFields;
  const following = nextMissingField(next);
  if (following === null) {
    // Ask optional anythingElse once before submitting.
    return NextResponse.json({
      reply: "Love it. Last one — anything else you want us to know? (You can say skip.)",
      collected: next,
      currentField: "anythingElse" as TensorWaitlistFieldKey,
      done: false,
      provider: "fallback",
    });
  }
  if (currentField === "anythingElse") {
    return NextResponse.json({
      reply: "Perfect — you're in. Submitting your spot now.",
      collected: next,
      currentField: null,
      done: true,
      provider: "fallback",
    });
  }
  return NextResponse.json({
    reply: scriptedPromptFor(following),
    collected: next,
    currentField: following,
    done: false,
    provider: "fallback",
  });
}
