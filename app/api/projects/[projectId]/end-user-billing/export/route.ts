import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit-log";

function parsePeriodToDate(period: string): Date | null {
    const now = Date.now();
    switch (period) {
        case "7d":
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case "30d":
            return new Date(now - 30 * 24 * 60 * 60 * 1000);
        case "90d":
            return new Date(now - 90 * 24 * 60 * 60 * 1000);
        case "all":
            return null;
        default:
            return new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
}

function escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

async function getProjectWithAccess(projectId: string) {
    const supabase = await createServerClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Unauthorized", status: 401 };

    const admin = createAdminClient();
    const { data: project } = await admin
        .from("projects")
        .select("id, organization_id, name")
        .eq("id", projectId)
        .single();

    if (!project) return { error: "Project not found", status: 404 };

    const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", project.organization_id)
        .eq("user_id", user.id)
        .single();

    if (!membership) return { error: "Insufficient permissions", status: 403 };

    return { project, user, admin };
}

// GET — export end-user usage data as CSV or JSON
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const result = await getProjectWithAccess(projectId);
    if ("error" in result) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status }
        );
    }

    const { project, user, admin } = result;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "csv";
    const period = url.searchParams.get("period") || "30d";
    const endUserId = url.searchParams.get("end_user_id") || null;

    if (!["csv", "json"].includes(format)) {
        return NextResponse.json(
            { error: "Invalid format. Must be csv or json." },
            { status: 400 }
        );
    }

    const startDate = parsePeriodToDate(period);

    try {
        let query = admin
            .from("ai_requests")
            .select(
                "id, end_user_id, model, provider, prompt_tokens, completion_tokens, total_tokens, provider_cost_usd, cencori_charge_usd, markup_percentage, status, latency_ms, created_at"
            )
            .eq("project_id", projectId)
            .not("end_user_id", "is", null)
            .neq("end_user_id", "")
            .order("created_at", { ascending: false })
            .limit(50000);

        if (startDate) {
            query = query.gte("created_at", startDate.toISOString());
        }

        if (endUserId) {
            query = query.eq("end_user_id", endUserId);
        }

        const { data: rows, error } = await query;

        if (error) {
            console.error("[EndUserBilling] Export query error:", error);
            return NextResponse.json(
                { error: "Failed to fetch usage data" },
                { status: 500 }
            );
        }

        const entries = rows || [];
        const isTruncated = entries.length === 50000;
        const dateStr = new Date().toISOString().split("T")[0];

        // Fire audit log for export
        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: "export",
            action: "exported",
            resourceType: "end_user_billing_usage",
            resourceId: projectId,
            actorId: user.id,
            actorEmail: user.email ?? null,
            actorIp:
                req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                null,
            actorType: "user",
            description: `Exported end-user billing usage (${format}, ${period}, ${entries.length} rows)`,
            metadata: { format, period, end_user_id: endUserId, row_count: entries.length },
        });

        if (format === "csv") {
            const csvHeaders = [
                "Request ID",
                "End User ID",
                "Model",
                "Provider",
                "Prompt Tokens",
                "Completion Tokens",
                "Total Tokens",
                "Provider Cost (USD)",
                "Customer Charge (USD)",
                "Markup %",
                "Status",
                "Latency (ms)",
                "Created At",
            ];

            const csvRows: string[] = [csvHeaders.join(",")];

            for (const row of entries) {
                csvRows.push(
                    [
                        escapeCSV(row.id || ""),
                        escapeCSV(row.end_user_id || ""),
                        escapeCSV(row.model || ""),
                        escapeCSV(row.provider || ""),
                        String(row.prompt_tokens || 0),
                        String(row.completion_tokens || 0),
                        String(row.total_tokens || 0),
                        String(row.provider_cost_usd || 0),
                        String(row.cencori_charge_usd || 0),
                        String(row.markup_percentage || 0),
                        escapeCSV(row.status || ""),
                        String(row.latency_ms || 0),
                        escapeCSV(
                            row.created_at
                                ? new Date(row.created_at).toISOString()
                                : ""
                        ),
                    ].join(",")
                );
            }

            const filename = `end-user-usage-${projectId.slice(0, 8)}-${period}-${dateStr}.csv`;

            return new NextResponse(csvRows.join("\n"), {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    ...(isTruncated ? { "X-Data-Truncated": "true", "X-Max-Rows": "50000" } : {}),
                },
            });
        }

        // JSON export
        const jsonPayload = {
            project_id: projectId,
            period,
            exported_at: new Date().toISOString(),
            total_rows: entries.length,
            truncated: isTruncated,
            usage: entries.map((row) => ({
                request_id: row.id,
                end_user_id: row.end_user_id,
                model: row.model,
                provider: row.provider,
                prompt_tokens: row.prompt_tokens || 0,
                completion_tokens: row.completion_tokens || 0,
                total_tokens: row.total_tokens || 0,
                provider_cost_usd: parseFloat(row.provider_cost_usd) || 0,
                customer_charge_usd: parseFloat(row.cencori_charge_usd) || 0,
                markup_percentage: parseFloat(row.markup_percentage) || 0,
                status: row.status,
                latency_ms: row.latency_ms,
                created_at: row.created_at,
            })),
        };

        const filename = `end-user-usage-${projectId.slice(0, 8)}-${period}-${dateStr}.json`;

        return new NextResponse(JSON.stringify(jsonPayload, null, 2), {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("[EndUserBilling] Export error:", error);
        return NextResponse.json(
            { error: "Failed to export usage data" },
            { status: 500 }
        );
    }
}
