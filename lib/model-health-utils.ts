// import { sendChatRequest } from "@/lib/gemini";

// // ── Types ────────────────────────────────────────────────────────
// export type ModelStatus = "available" | "degraded" | "unavailable";

// export interface ModelHealthCheck {
//   id: string;
//   projectId: string;
//   modelName: string;
//   provider: string;
//   status: ModelStatus;
//   latencyMs: number;
//   errorMessage: string | null;
//   checkedAt: string;
// }

// export interface ModelHealthResult {
//   model: string;
//   provider: string;
//   status: ModelStatus;
//   latencyMs: number;
//   lastChecked: string;
//   uptime24h: number;
//   circuitBreaker: "closed" | "open" | "half-open";
// }

// // ── Thresholds (configurable via environment variables) ──────────
// // Read once at module load time — changing env vars requires restart
// export const DEGRADED_THRESHOLD_MS = parseInt(
//   process.env.HEALTH_DEGRADED_THRESHOLD_MS ?? "1000",
// );

// export const UNAVAILABLE_THRESHOLD_MS = parseInt(
//   process.env.HEALTH_UNAVAILABLE_THRESHOLD_MS ?? "5000",
// );

// // ── Status determination ─────────────────────────────────────────
// // Exported so unit tests (File 12) can call it directly
// export function determineStatus(
//   latencyMs: number,
//   hasError: boolean,
// ): ModelStatus {
//   if (hasError || latencyMs > UNAVAILABLE_THRESHOLD_MS) return "unavailable";
//   if (latencyMs > DEGRADED_THRESHOLD_MS) return "degraded";
//   return "available";
// }

// // ── Uptime percentage calculation ─────────────────────────────────
// // Exported so unit tests (File 11) can call it directly
// // 'degraded' checks count as NOT available — only 'available' counts as up
// export function calculateUptimePercentage(
//   checks: Pick<ModelHealthCheck, "status">[],
// ): number {
//   if (checks.length === 0) return 0; // no data — return 0, not NaN

//   const upCount = checks.filter((c) => c.status === "available").length;
//   return Math.round((upCount / checks.length) * 1000) / 10; // 1 decimal place
// }

// // ── Error message sanitizer ───────────────────────────────────────
// // Removes API keys and internal URLs from error messages
// // so they never appear in API responses or logs
// const CREDENTIAL_PATTERN = /[A-Za-z0-9_\-]{32,}/g;
// const URL_PATTERN = /https?:\/\/[^\s]+/g;

// export function sanitizeErrorMessage(message: string): string {
//   return message
//     .replace(CREDENTIAL_PATTERN, "[REDACTED]")
//     .replace(URL_PATTERN, "[URL_REMOVED]");
// }

// // ── Model ping ───────────────────────────────────────────────────
// // Sends a minimal request to the model and measures response time.
// // Uses sendChatRequest which routes through the existing provider
// // system — this means circuit breakers and failover still apply.
// export async function pingModel(
//   modelName: string,
//   _provider: string, // kept for future per-provider routing
// ): Promise<{ latencyMs: number; error?: string }> {
//   const start = Date.now();

//   try {
//     await sendChatRequest({
//       messages: [{ role: "user", parts: [{ text: "Hi" }] }],
//       model: modelName,
//       temperature: 0,
//       maxOutputTokens: 1, // minimal tokens — this is just a ping
//     });

//     return { latencyMs: Date.now() - start };
//   } catch (err: unknown) {
//     const latencyMs = Date.now() - start;
//     const raw = err instanceof Error ? err.message : String(err);
//     return {
//       latencyMs,
//       error: sanitizeErrorMessage(raw), // sanitize before returning
//     };
//   }
// }

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

  try {
    if (provider === "openai") {
      await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "anthropic") {
      await anthropic.messages.create({
        model: modelName,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      });
    } else {
      // Default to Gemini/Google
      await sendChatRequest({
        messages: [{ role: "user", parts: [{ text: "Hi" }] }],
        model: modelName,
        temperature: 0,
        maxOutputTokens: 1,
      });
    }

    return { latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const raw = err instanceof Error ? err.message : String(err);
    return {
      latencyMs,
      error: sanitizeErrorMessage(raw),
    };
  }
}
