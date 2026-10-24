import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// The maintenance window for the dashboard banner (MaintenanceBanner): the
// announced schedule while it hasn't ended, and whether maintenance is on now
// (only bypass-token holders get a page to show that on). Public; nothing in
// the row is secret.
// Local preview without touching the shared row: MAINTENANCE_PREVIEW=
// scheduled | underway | on, ignored in production.
function previewResponse(): NextResponse | null {
  const preview = process.env.NODE_ENV === "production" ? undefined : process.env.MAINTENANCE_PREVIEW;
  if (!preview) return null;
  const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  const body =
    preview === "on"
      ? { enabled: true, scheduled: null }
      : preview === "underway"
        ? { enabled: false, scheduled: { start: at(-5), end: at(25) } }
        : { enabled: false, scheduled: { start: at(24 * 60), end: at(24 * 60 + 30) } };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const preview = previewResponse();
  if (preview) return preview;

  const { data, error } = await createAdminClient()
    .from("platform_maintenance")
    .select("enabled, scheduled_start, scheduled_end")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("[Maintenance] Could not read the schedule", error);
    return NextResponse.json({ enabled: false, scheduled: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const end = data?.scheduled_end ? new Date(data.scheduled_end) : null;
  const scheduled =
    data?.scheduled_start && end && end.getTime() > Date.now()
      ? { start: data.scheduled_start as string, end: data.scheduled_end as string }
      : null;

  return NextResponse.json(
    { enabled: data?.enabled === true, scheduled },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  );
}
