import { NextRequest, NextResponse } from "next/server";

// We track recent 'down' results to detect 3 consecutive failures.
// This is a simple in-memory counter — good enough for a single server instance.
const downStreak: Record<string, number> = {
  database: 0,
  aiGateway: 0,
  memory: 0,
};

export async function GET(request: NextRequest) {
  // ── Step 1: Verify the request is from Vercel's cron system ──
  // Vercel sends the CRON_SECRET we set in environment variables.
  // Without this check, anyone who discovers the URL could trigger it.
  const secret = request.headers.get("x-cron-secret");

  if (secret !== process.env.CRON_SECRET) {
    console.warn("[cron] Unauthorized cron attempt blocked");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Step 2: Call the health endpoint internally ───────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.error("[cron] NEXT_PUBLIC_APP_URL is not set");
    return NextResponse.json({ error: "Configuration error" }, { status: 500 });
  }

  let healthData;
  try {
    const response = await fetch(`${appUrl}/api/health/detailed`, {
      headers: {
        // Pass the secret so the health route allows this cron request
        "x-cron-secret": process.env.CRON_SECRET ?? "",
      },
    });

    if (!response.ok) {
      throw new Error(`Health endpoint returned ${response.status}`);
    }

    healthData = await response.json();
  } catch (err) {
    console.error("[cron] Failed to reach health endpoint:", err);
    return NextResponse.json(
      { ok: false, error: "Health check failed" },
      { status: 500 },
    );
  }

  // ── Step 3: Track consecutive failures and log warnings ───────
  const services = healthData?.services ?? {};

  for (const [name, data] of Object.entries(services) as [string, any][]) {
    if (data.status === "down") {
      downStreak[name] = (downStreak[name] ?? 0) + 1;

      if (downStreak[name] >= 3) {
        // 3 consecutive failures — escalate to error log
        console.error(
          `[cron] ALERT: ${name} has been DOWN for ${downStreak[name]} consecutive checks.`,
        );
        // In a real system you would send a Slack message or PagerDuty alert here.
      } else {
        console.warn(
          `[cron] WARNING: ${name} is DOWN (streak: ${downStreak[name]})`,
        );
      }
    } else {
      // Reset the streak when a service recovers
      downStreak[name] = 0;
    }
  }

  // ── Step 4: Return success ─────────────────────────────────────
  console.log(`[cron] Health check complete. Overall: ${healthData?.status}`);
  return NextResponse.json({ ok: true, status: healthData?.status });
}
