import { sendChatRequest } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabaseAdmin";

// ── Types ────────────────────────────────────────────────────────
interface ModelSummary {
  modelName: string;
  provider: string;
  avgLatencyMs: number;
  uptime: number;
  incidentCount: number;
}

const FALLBACK = "Weekly report unavailable.";
const NO_DATA = "No health check data available for this period.";

// ── Prompt builder ───────────────────────────────────────────────
export function buildReportPrompt(summaries: ModelSummary[]): string {
  const lines = summaries
    .map(
      (s) =>
        `- ${s.modelName} (${s.provider}): ${s.uptime}% uptime, ` +
        `avg ${s.avgLatencyMs}ms, ${s.incidentCount} incident(s)`,
    )
    .join("\n");

  console.log(
    `[model-health-report] buildReportPrompt: building prompt for ${summaries.length} model(s)`,
  );

  return `
You are an AI infrastructure analyst. Write ONE paragraph (3-5 sentences)
summarising the weekly availability of these AI models. Highlight the most
reliable model, any that had incidents, and any latency trends. Be specific.

Weekly model health summary:
${lines}

Write only the summary paragraph. No headings or bullet points.
`.trim();
}

// ── Main export ───────────────────────────────────────────────────
export async function generateWeeklyReport(projectId: string): Promise<string> {
  console.log(
    "[model-health-report] generateWeeklyReport called for projectId:",
    projectId,
  );

  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log("[model-health-report] Fetching health checks since:", since);

  const { data: rows, error } = await admin
    .from("model_health_checks")
    .select("model_name, provider, status, latency_ms")
    .eq("project_id", projectId)
    .gte("checked_at", since);

  if (error) {
    console.error("[model-health-report] DB query failed:", error.message);
    return NO_DATA;
  }

  if (!rows || rows.length === 0) {
    console.log(
      "[model-health-report] No data found for this project — returning NO_DATA",
    );
    return NO_DATA;
  }

  console.log(`[model-health-report] ${rows.length} health check rows fetched`);

  // Group by model and compute per-model stats
  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!grouped[row.model_name]) grouped[row.model_name] = [];
    grouped[row.model_name].push(row);
  }

  const summaries: ModelSummary[] = Object.entries(grouped).map(
    ([name, checks]) => {
      const available = checks.filter((c) => c.status === "available").length;
      const latencies = checks.map((c) => c.latency_ms ?? 0);
      const avgLatency =
        latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0;

      return {
        modelName: name,
        provider: checks[0].provider,
        avgLatencyMs: avgLatency,
        uptime: Math.round((available / checks.length) * 100),
        incidentCount: checks.filter((c) => c.status === "unavailable").length,
      };
    },
  );

  console.log("[model-health-report] Model summaries computed:");
  summaries.forEach((s) => {
    console.log(
      `  ${s.modelName}: ${s.uptime}% uptime, avg ${s.avgLatencyMs}ms, ${s.incidentCount} incident(s)`,
    );
  });

  try {
    console.log("[model-health-report] Calling Gemini for weekly report...");

    const response = await sendChatRequest({
      messages: [
        { role: "user", parts: [{ text: buildReportPrompt(summaries) }] },
      ],
      model: "gemini-2.5-flash",
      temperature: 0.3,
      maxOutputTokens: 300,
    });

    const report = response.text?.trim();

    if (!report) throw new Error("Empty response from Gemini");

    console.log("[model-health-report] Gemini report received:", report);
    return report;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[model-health-report] Gemini failed:", msg);
    console.log("[model-health-report] Returning fallback");
    return FALLBACK;
  }
}
