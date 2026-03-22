import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  listOldExportFiles,
  deleteExportFile,
} from "@/lib/scan-export-storage";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    console.warn("[cron:cleanup-exports] Unauthorized attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  let filesDeleted = 0;
  let dbRowsDeleted = 0;
  const errors: string[] = [];

  //  Delete Storage files older than 24 hours
  try {
    const oldFiles = await listOldExportFiles(DAY_MS);
    console.log(
      `[cron:cleanup-exports] Found ${oldFiles.length} file(s) to delete`,
    );

    for (const filePath of oldFiles) {
      await deleteExportFile(filePath);
      filesDeleted++;
    }

    console.log(
      `[cron:cleanup-exports] Deleted ${filesDeleted} Storage file(s)`,
    );
  } catch (err: unknown) {
    const msg = `Storage cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[cron:cleanup-exports]", msg);
    errors.push(msg);
  }

  // Delete DB records older than 90 days
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - 90 * DAY_MS).toISOString();

    const { error, count } = await admin
      .from("scan_exports")
      .delete({ count: "exact" })
      .lt("created_at", cutoff);

    if (error) throw error;

    dbRowsDeleted = count ?? 0;
    console.log(`[cron:cleanup-exports] Deleted ${dbRowsDeleted} DB record(s)`);
  } catch (err: unknown) {
    const msg = `DB cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[cron:cleanup-exports]", msg);
    errors.push(msg);
  }

  const durationMs = Date.now() - start;
  console.log(`[cron:cleanup-exports] Done in ${durationMs}ms`);

  return NextResponse.json({
    ok: errors.length === 0,
    filesDeleted,
    dbRowsDeleted,
    durationMs,
    errors,
  });
}
