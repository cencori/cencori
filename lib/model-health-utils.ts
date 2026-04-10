import { sendChatRequest } from "@/lib/gemini";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// 1. Initialize SDK clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 2. Thresholds (MUST BE AT THE TOP to avoid "Cannot find name" errors)
export const DEGRADED_THRESHOLD_MS = parseInt(
  process.env.HEALTH_DEGRADED_THRESHOLD_MS ?? "1000",
);

export const UNAVAILABLE_THRESHOLD_MS = parseInt(
  process.env.HEALTH_UNAVAILABLE_THRESHOLD_MS ?? "5000",
);

// ── Types ────────────────────────────────────────────────────────
export type ModelStatus = "available" | "degraded" | "unavailable";

export interface ModelHealthCheck {
  id: string;
  projectId: string;
  modelName: string;
  provider: string;
  status: ModelStatus;
  latencyMs: number;
  errorMessage: string | null;
  checkedAt: string;
}

// ── Status determination ─────────────────────────────────────────
export function determineStatus(
  latencyMs: number,
  hasError: boolean,
): ModelStatus {
  // Now these variables are guaranteed to be initialized
  if (hasError || latencyMs > UNAVAILABLE_THRESHOLD_MS) return "unavailable";
  if (latencyMs > DEGRADED_THRESHOLD_MS) return "degraded";
  return "available";
}

// ── Uptime percentage calculation ─────────────────────────────────
export function calculateUptimePercentage(
  checks: Pick<ModelHealthCheck, "status">[],
): number {
  if (checks.length === 0) return 0;
  const upCount = checks.filter((c) => c.status === "available").length;
  return Math.round((upCount / checks.length) * 1000) / 10;
}

// ── Error message sanitizer ───────────────────────────────────────
export function sanitizeErrorMessage(message: string): string {
  const CREDENTIAL_PATTERN = /[A-Za-z0-9_\-]{32,}/g;
  const URL_PATTERN = /https?:\/\/[^\s]+/g;
  return message
    .replace(CREDENTIAL_PATTERN, "[REDACTED]")
    .replace(URL_PATTERN, "[URL_REMOVED]");
}

// ── Model ping ───────────────────────────────────────────────────
export async function pingModel(
  modelName: string,
  provider: string,
): Promise<{ latencyMs: number; error?: string }> {
  const start = Date.now();

  // Infer the correct provider from the model name
  // regardless of what's stored in the DB
  const inferredProvider = inferProvider(modelName, provider);

  try {
    if (inferredProvider === "openai") {
      await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (inferredProvider === "anthropic") {
      await anthropic.messages.create({
        model: modelName,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      });
    } else if (inferredProvider === "google") {
      await sendChatRequest({
        messages: [{ role: "user", parts: [{ text: "Hi" }] }],
        model: modelName,
        temperature: 0,
        maxOutputTokens: 1,
      });
    } else {
      console.warn(
        `[model-health] Unsupported provider "${inferredProvider}" for model "${modelName}" — skipping`,
      );
      return {
        latencyMs: 0,
        error: `Unsupported provider: ${inferredProvider}`,
      };
    }

    return { latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const raw = err instanceof Error ? err.message : String(err);
    return { latencyMs, error: sanitizeErrorMessage(raw) };
  }
}

// Infer the real provider from the model name, falling back to stored value
function inferProvider(modelName: string, storedProvider: string): string {
  const name = modelName.toLowerCase();

  if (name.startsWith("claude-")) return "anthropic";
  if (name.startsWith("gemini-")) return "google";
  if (
    name.startsWith("gpt-") ||
    name.startsWith("o1") ||
    name.startsWith("o3") ||
    name.startsWith("o4")
  )
    return "openai";
  if (name.startsWith("llama-") || name.startsWith("mixtral-")) return "groq";

  // Fall back to whatever is stored if we can't infer
  return storedProvider;
}
