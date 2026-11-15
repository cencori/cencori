import { NextRequest, NextResponse } from "next/server";
import { cronDisabled } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { accountsWithApps, applyPlanToApps } from "@/lib/tensor-cloud-tasks";

// Once a day, every published Tensor app is brought in line with its owner's plan as it is now:
// new allowances when the plan changed, paused when it lapsed or no longer includes the app,
// served again when it does. Nothing is deleted: a paused app keeps its data.

async function run(request: NextRequest) {
  const off = cronDisabled();
  if (off) return off;
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = readTensorCloudConfig();
  if (!config) return NextResponse.json({ skipped: "Tensor cloud is not set up here." });

  const admin = createAdminClient();
  const totals = { accounts: 0, applied: 0, paused: 0, failed: 0 };
  for (const userId of await accountsWithApps(admin)) {
    try {
      const done = await applyPlanToApps(admin, config, userId);
      totals.accounts += 1;
      totals.applied += done.applied;
      totals.paused += done.paused;
      totals.failed += done.failed;
    } catch (error) {
      totals.failed += 1;
      console.error(`[Cron] Applying plans to the Tensor apps of ${userId} failed`, error);
    }
  }
  console.log("[Cron] Tensor apps brought in line with plans", totals);
  return NextResponse.json({ success: true, ...totals, timestamp: new Date().toISOString() });
}

export const GET = run;
export const POST = run;
