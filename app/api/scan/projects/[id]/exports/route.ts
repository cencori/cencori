import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  buildCsvExport,
  buildJsonExport,
  redactFindingsForExport,
  ScanFinding,
  ScanResult,
} from "@/lib/scan-export-utils";
import { generateExportSummary } from "@/lib/scan-export-summary";

// ── Rate limiter (max 10 exports per hour per user) ──────────────
const exportRateMap = new Map<string, { count: number; resetAt: number }>();

function checkExportRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = parseInt(process.env.EXPORT_RATE_LIMIT_PER_HOUR ?? "10");
  const entry = exportRateMap.get(userId);

  if (!entry || now > entry.resetAt) {
    exportRateMap.set(userId, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── Storage helpers ───────────────────────────────────────────────
async function uploadExportFile(
  fileBlob: Blob,
  fileName: string,
  contentType: string,
): Promise<string> {
  const admin = createAdminClient();
  const filePath = `exports/${Date.now()}-${fileName}`;

  const { error } = await admin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET ?? "scan-exports")
    .upload(filePath, fileBlob, { contentType, upsert: false });

  if (error) throw new Error(`[storage] Upload failed: ${error.message}`);
  return filePath;
}

async function getSignedDownloadUrl(filePath: string): Promise<string> {
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET ?? "scan-exports")
    .createSignedUrl(filePath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(
      `[storage] Signed URL failed: ${error?.message ?? "unknown"}`,
    );
  }
  return data.signedUrl;
}

// ── Main route handler ───────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id: projectId } = await params;

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const includeAiSummary =
    request.nextUrl.searchParams.get("aiSummary") !== "false";

  // 1. Validate format early
  if (!["csv", "json", "pdf"].includes(format)) {
    return NextResponse.json(
      { error: "Invalid format. Use csv, json, or pdf." },
      { status: 400 },
    );
  }

  // 2. Authenticate
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Rate limit
  if (!checkExportRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 10 exports per hour." },
      { status: 429 },
    );
  }

  const admin = createAdminClient();

  // 4. Verify project access
  const { data: project, error: projectError } = await admin
    .from("scan_projects")
    .select("user_id")
    .eq("id", projectId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  console.log("[export] project lookup:", {
    projectId,
    project,
    error: projectError?.message,
  });

  if (!project) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Create export record with status 'generating'
  const { data: exportRecord, error: insertError } = await admin
    .from("scan_exports")
    .insert({
      project_id: projectId,
      user_id: session.user.id,
      format,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !exportRecord) {
    console.error(
      "[export] Failed to create export record:",
      insertError?.message,
    );
    return NextResponse.json(
      { error: "Failed to start export" },
      { status: 500 },
    );
  }

  const exportId = exportRecord.id as string;

  // Helper: mark the export as failed and return an error response
  async function failExport(message: string, httpStatus = 500) {
    await admin
      .from("scan_exports")
      .update({ status: "failed", error_message: message })
      .eq("id", exportId);
    return NextResponse.json({ error: message }, { status: httpStatus });
  }

  try {
    // 6. Fetch findings from the latest completed scan run
    const { data: latestRun, error: findingsError } = await admin
      .from("scan_runs")
      .select("results")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("[export] findings lookup:", {
      count: (latestRun?.results as Record<string, unknown>)?.issues
        ? ((latestRun?.results as Record<string, unknown>).issues as unknown[])
            .length
        : 0,
      error: findingsError?.message,
    });

    if (findingsError) return await failExport("Failed to fetch findings");

    // 7. Map raw issues to ScanFinding shape
    // scan_runs.results.issues use `name` instead of `title` and may lack `recommendation`
    const rawIssues =
      ((latestRun?.results as Record<string, unknown>)?.issues as Record<
        string,
        unknown
      >[]) ?? [];

    const findings: ScanFinding[] = rawIssues.map((issue) => ({
      severity: ((issue.severity as string) ??
        "low") as ScanFinding["severity"],
      title:
        (issue.name as string) ?? (issue.title as string) ?? "Unknown Issue",
      file: (issue.file as string) ?? "",
      line: (issue.line as number) ?? null,
      description: (issue.description as string) ?? "",
      recommendation: (issue.recommendation as string) ?? "",
    }));

    // 8. Redact credentials from all findings before export
    const safeFindings = redactFindingsForExport(findings);

    let fileBlob: Blob;
    let contentType: string;
    let fileName: string;
    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      contentType = "text/csv";
      fileName = `scan-export-${projectId}-${dateStr}.csv`;
      fileBlob = new Blob([buildCsvExport(safeFindings)], {
        type: contentType,
      });
    } else if (format === "json") {
      const scanResult: ScanResult = {
        id: exportId,
        projectId,
        scanDate: dateStr,
        repository: projectId,
        findings: safeFindings,
      };
      contentType = "application/json";
      fileName = `scan-export-${projectId}-${dateStr}.json`;
      fileBlob = new Blob([buildJsonExport(scanResult)], { type: contentType });
    } else {
      // PDF
      let aiSummary = "";
      if (includeAiSummary) {
        aiSummary = await generateExportSummary(safeFindings, {
          repository: projectId,
          scanDate: dateStr,
        });
      }
      contentType = "application/pdf";
      fileName = `scan-export-${projectId}-${dateStr}.pdf`;
      fileBlob = new Blob(
        [buildPdfHtml(safeFindings, aiSummary, projectId, dateStr)],
        { type: contentType },
      );
    }

    // 9. Upload to Supabase Storage
    const filePath = await uploadExportFile(fileBlob, fileName, contentType);
    const signedUrl = await getSignedDownloadUrl(filePath);

    // 10. Update export record to completed
    await admin
      .from("scan_exports")
      .update({
        status: "completed",
        download_url: signedUrl,
        file_size_bytes: fileBlob.size,
        finding_count: safeFindings.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    // 11. Audit log — fire and forget
    void (async () => {
      try {
        await admin.from("audit_logs").insert({
          user_id: session.user.id,
          project_id: projectId,
          action: "scan_export",
          metadata: {
            format,
            finding_count: safeFindings.length,
            export_id: exportId,
          },
        });
      } catch (auditErr: unknown) {
        const msg =
          auditErr instanceof Error ? auditErr.message : String(auditErr);
        console.warn("[export] Audit log failed:", msg);
      }
    })();

    // 12. Return the file to the browser
    return new NextResponse(fileBlob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(fileBlob.size),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    console.error("[export] Unexpected error:", message);
    return await failExport(message);
  }
}

// ── PDF HTML builder ─────────────────────────────────────────────
function buildPdfHtml(
  findings: ScanFinding[],
  aiSummary: string,
  projectId: string,
  dateStr: string,
): string {
  const rows = findings
    .map(
      (f) => `
    <tr>
      <td class="sev ${f.severity}">${f.severity}</td>
      <td>${f.title}</td>
      <td>${f.file}:${f.line ?? ""}</td>
      <td>${f.description}</td>
      <td>${f.recommendation}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; }
  h1   { color: #1B3F6B; }
  .summary { background: #D6E8F8; padding: 12px; border-radius: 4px; margin-bottom: 20px; }
  table  { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th     { background: #1B3F6B; color: white; }
  .critical { color: #7A1515; font-weight: bold; }
  .high     { color: #A84C00; font-weight: bold; }
  .medium   { color: #A87A00; }
  .low      { color: #444; }
</style></head><body>
  <h1>Scan Export Report</h1>
  <p>Project: ${projectId} | Date: ${dateStr} | Total findings: ${findings.length}</p>
  ${
    aiSummary
      ? `<div class="summary"><strong>Executive Summary</strong><p>${aiSummary}</p></div>`
      : ""
  }
  <table>
    <thead>
      <tr>
        <th>Severity</th><th>Title</th><th>Location</th>
        <th>Description</th><th>Recommendation</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
}
