import gemini from "@/lib/gemini"; // The existing Gemini client

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
// We store { value: string, expiresAt: number }
// expiresAt is a Unix timestamp in milliseconds
const cache: { value: string; expiresAt: number } | null = null;
let _cache: typeof cache = null;

// ── Prompt Builder ─────────────────────────────────────────────
// Exported so the unit test (File 10) can verify the prompt content
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

  // 1. Return cached result if it is still fresh
  const now = Date.now();
  if (_cache && now < _cache.expiresAt) {
    return _cache.value;
  }

  try {
    // 2. Build the prompt
    const prompt = buildHealthPrompt(data);

    // 3. Call Gemini via the existing client
    //    Adjust the method call to match how lib/gemini.ts exposes its API
    const result = await gemini.generateContent(prompt);
    const summary = result?.response?.text()?.trim();

    if (!summary) throw new Error("Empty response from Gemini");

    // 4. Store in cache
    _cache = { value: summary, expiresAt: now + CACHE_TTL_MS };

    return summary;
  } catch (err) {
    // 5. If anything goes wrong, return the fallback
    //    Log the error server-side for debugging but never surface it to users
    console.error("[health-summary] Gemini call failed:", err);
    return FALLBACK;
  }
}

// Exported for tests that need to reset the cache between test cases
export function _resetCacheForTesting() {
  _cache = null;
}
