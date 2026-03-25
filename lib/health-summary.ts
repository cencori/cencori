import { sendChatRequest } from "@/lib/gemini";

// ── Types ──────────────────────────────────────────────────────
interface ServiceHealth {
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  error?: string;
}

interface HealthData {
  status: "healthy" | "degraded" | "down";
  services: {
    database: ServiceHealth;
    aiGateway: ServiceHealth;
    memory: ServiceHealth;
  };
}

// ── Simple 60-second in-memory cache ──────────────────────────
// Stores { value: string, expiresAt: number }
// expiresAt is a Unix timestamp in milliseconds
// Module-level so it persists between requests on the same server instance
let _cache: { value: string; expiresAt: number } | null = null;

// ── Prompt Builder ─────────────────────────────────────────────
// Exported so the unit test can verify the prompt content directly
export function buildHealthPrompt(data: HealthData): string {
  const { database, aiGateway, memory } = data.services;

  return `
You are a system monitoring assistant. Summarize the current health of a software platform in 1-2 sentences. Be factual and concise. Do not use technical jargon.

Current system status: ${data.status}

Services:
- Database: ${database.status}, latency ${database.latencyMs}ms${database.error ? ", error: " + database.error : ""}
- AI Gateway: ${aiGateway.status}, latency ${aiGateway.latencyMs}ms${aiGateway.error ? ", error: " + aiGateway.error : ""}
- Memory: ${memory.status}, latency ${memory.latencyMs}ms${memory.error ? ", error: " + memory.error : ""}

Respond with ONLY the summary sentence(s). No preamble, no bullet points.
`.trim();
}

// ── Main Export ────────────────────────────────────────────────
export async function generateHealthSummary(data: HealthData): Promise<string> {
  const FALLBACK = "All systems operational.";
  const CACHE_TTL_MS = 60_000; // 60 seconds

  // Return cached result if it is still fresh
  const now = Date.now();
  if (_cache && now < _cache.expiresAt) {
    console.log("[health-summary] Cache hit — returning cached summary");
    return _cache.value;
  }

  console.log("[health-summary] Cache miss — calling Gemini...");

  try {
    // Build the prompt
    const prompt = buildHealthPrompt(data);
    console.log("[health-summary] Prompt built, sending to Gemini...");

    // Call Gemini via sendChatRequest — the only named export from lib/gemini.ts
    // sendChatRequest returns a ChatResponse where .text is a plain string
    const response = await sendChatRequest({
      messages: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      model: "gemini-2.5-flash",
      temperature: 0.3,
      maxOutputTokens: 200,
    });

    const summary = response.text?.trim();
    console.log("[health-summary] Gemini responded:", summary);

    if (!summary) throw new Error("Empty response from Gemini");

    // Store in cache with expiry
    _cache = { value: summary, expiresAt: now + CACHE_TTL_MS };
    console.log("[health-summary] Cached for 60 seconds");

    return summary;
  } catch (err: unknown) {
    // If anything goes wrong return the fallback
    // Log server-side for debugging but never surface raw errors to users
    const message = err instanceof Error ? err.message : String(err);
    console.error("[health-summary] Gemini call failed:", message);
    console.log("[health-summary] Returning fallback");
    return FALLBACK;
  }
}

// ── Test helper ────────────────────────────────────────────────
// Exported so tests can reset the cache between test cases
// Prefixed with _ to signal this is for internal/test use only
export function _resetCacheForTesting(): void {
  _cache = null;
}
