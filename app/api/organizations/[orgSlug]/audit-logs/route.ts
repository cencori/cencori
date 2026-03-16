import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const EVENT_LABELS: Record<string, string> = {
    settings_updated: "Settings Updated",
    api_key_created: "API Key Created",
    api_key_deleted: "API Key Deleted",
    api_key_rotated: "API Key Rotated",
    webhook_created: "Webhook Created",
    webhook_deleted: "Webhook Deleted",
    incident_reviewed: "Incident Reviewed",
    ip_blocked: "IP Blocked",
    rate_limit_exceeded: "Rate Limit Exceeded",
    auth_failed: "Auth Failed",
    content_filter: "Content Blocked",
    intent_analysis: "Intent Blocked",
    jailbreak: "Jailbreak Attempt",
    prompt_injection: "Prompt Injection",
    output_leakage: "Output Leakage",
    pii_input: "PII Detected (Input)",
    pii_output: "PII Detected (Output)",
    data_rule_block: "Data Rule Blocked",
    data_rule_mask: "Data Masked",
    data_rule_redact: "Data Redacted",
    data_rule_tokenize: "Data Tokenized",
    sso_configured: "SSO Configured",
    sso_removed: "SSO Removed",
    member_invited: "Member Invited",
    member_removed: "Member Removed",
    member_role_changed: "Member Role Changed",
    org_updated: "Organization Updated",
};

function escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function parseTimeRange(timeRange: string): Date {
    const now = Date.now();
    switch (timeRange) {
        case "1h": return new Date(now - 60 * 60 * 1000);
        case "24h": return new Date(now - 24 * 60 * 60 * 1000);
        case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case "30d": return new Date(now - 30 * 24 * 60 * 60 * 1000);
        case "90d": return new Date(now - 90 * 24 * 60 * 60 * 1000);
        case "all": return new Date(0);
        default: return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
}

async function getOrgWithAccess(orgSlug: string) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Unauthorized", status: 401 };

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", orgSlug)
        .single();

    if (!org) return { error: "Organization not found", status: 404 };

    // Verify membership
    const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return { error: "Insufficient permissions", status: 403 };
    }

    // Get all project IDs in this org
    const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", org.id);

    return { org, user, projects: projects || [], supabase };
}

interface AuditEntry {
    id: string;
    event_type: string;
    actor_email: string | null;
    actor_ip: string | null;
    project_name: string | null;
    details: Record<string, unknown>;
    created_at: string;
}

// GET — paginated org-level audit logs (viewer) or CSV/JSON export
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const { orgSlug } = await params;
    const result = await getOrgWithAccess(orgSlug);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { org, projects, supabase } = result;
    const url = new URL(req.url);
    const format = url.searchParams.get("format"); // csv, json, or null (paginated viewer)
    const eventType = url.searchParams.get("event_type") || "all";
    const timeRange = url.searchParams.get("time_range") || "7d";
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50"), 100);

    const startDate = parseTimeRange(timeRange);
    const projectIds = projects.map((p) => p.id);
    const projectNameMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

    if (projectIds.length === 0) {
        if (format === "csv") {
            return new NextResponse("Timestamp,Event,Project,Actor,IP Address,Details\n", {
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="audit-log-${org.slug}-empty.csv"`,
                },
            });
        }
        if (format === "json") {
            return NextResponse.json({ logs: [], organization: org.name });
        }
        return NextResponse.json({ logs: [], pagination: { page: 1, per_page: perPage, total: 0, total_pages: 0 } });
    }

    const limit = format ? 50000 : perPage * 2; // larger limit for exports
    const allLogs: AuditEntry[] = [];

    // Security incidents across all projects
    const securityTypes = ["content_filter", "intent_analysis", "jailbreak", "prompt_injection", "output_leakage", "pii_input", "pii_output"];
    const adminTypes = ["settings_updated", "api_key_created", "api_key_deleted", "api_key_rotated", "webhook_created", "webhook_deleted", "incident_reviewed", "ip_blocked", "rate_limit_exceeded", "auth_failed"];

    if (eventType === "all" || securityTypes.includes(eventType)) {
        let query = supabase
            .from("security_incidents")
            .select("*")
            .in("project_id", projectIds)
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: false })
            .limit(limit);

        if (eventType !== "all" && securityTypes.includes(eventType)) {
            query = query.eq("incident_type", eventType);
        }

        const { data: incidents } = await query;
        if (incidents) {
            for (const i of incidents) {
                allLogs.push({
                    id: i.id,
                    event_type: i.incident_type,
                    actor_email: null,
                    actor_ip: null,
                    project_name: projectNameMap[i.project_id] || null,
                    details: {
                        severity: i.severity,
                        risk_score: i.risk_score,
                        action_taken: i.action_taken,
                        description: typeof i.description === "string" ? i.description.substring(0, 200) : null,
                        ...(i.details && typeof i.details === "object" ? i.details as Record<string, unknown> : {}),
                    },
                    created_at: i.created_at,
                });
            }
        }
    }

    // Admin audit log entries across all projects
    if (eventType === "all" || adminTypes.includes(eventType)) {
        let query = supabase
            .from("security_audit_log")
            .select("*")
            .in("project_id", projectIds)
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: false })
            .limit(limit);

        if (eventType !== "all" && adminTypes.includes(eventType)) {
            query = query.eq("event_type", eventType);
        }

        const { data: auditLogs } = await query;
        if (auditLogs) {
            for (const log of auditLogs) {
                allLogs.push({
                    id: log.id,
                    event_type: log.event_type,
                    actor_email: log.actor_email,
                    actor_ip: log.actor_ip,
                    project_name: projectNameMap[log.project_id] || null,
                    details: log.details || {},
                    created_at: log.created_at,
                });
            }
        }
    }

    allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // CSV export
    if (format === "csv") {
        const rows: string[] = [
            ["Timestamp", "Event", "Project", "Actor", "IP Address", "Details"].join(","),
        ];
        for (const log of allLogs) {
            rows.push([
                escapeCSV(new Date(log.created_at).toISOString()),
                escapeCSV(EVENT_LABELS[log.event_type] || log.event_type),
                escapeCSV(log.project_name || "-"),
                escapeCSV(log.actor_email || "System"),
                escapeCSV(log.actor_ip || "-"),
                escapeCSV(Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : "-"),
            ].join(","));
        }
        const filename = `audit-log-${org.slug}-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`;
        return new NextResponse(rows.join("\n"), {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    }

    // JSON export
    if (format === "json") {
        const filename = `audit-log-${org.slug}-${timeRange}-${new Date().toISOString().split("T")[0]}.json`;
        return new NextResponse(
            JSON.stringify({ organization: org.name, exported_at: new Date().toISOString(), logs: allLogs }, null, 2),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                },
            }
        );
    }

    // Paginated response for UI
    const total = allLogs.length;
    const paginated = allLogs.slice((page - 1) * perPage, page * perPage);

    return NextResponse.json({
        logs: paginated,
        pagination: {
            page,
            per_page: perPage,
            total,
            total_pages: Math.ceil(total / perPage),
        },
    });
}
