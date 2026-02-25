import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isScanStrictEnforcementEnabled } from "@/lib/scan/policy";
import { ScanMemoryError, writeMemory } from "@/lib/scan/scan-memory";

interface RouteParams {
    params: Promise<{ id: string; scanRunId: string }>;
}

async function requireProjectOwnership(projectId: string) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const supabaseAdmin = createAdminClient();
    const { data: project, error: projectError } = await supabaseAdmin
        .from("scan_projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (projectError || !project) {
        return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
    }

    return { user, project, supabaseAdmin };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
    const { id, scanRunId } = await params;
    const auth = await requireProjectOwnership(id);
    if ("error" in auth) return auth.error;

    const { supabaseAdmin, project } = auth;
    const { data: scanRun, error: scanError } = await supabaseAdmin
        .from("scan_runs")
        .select("*")
        .eq("id", scanRunId)
        .eq("project_id", id)
        .single();

    if (scanError || !scanRun) {
        return NextResponse.json({ error: "Scan run not found" }, { status: 404 });
    }

    return NextResponse.json({
        project: {
            id: project.id,
            github_repo_full_name: project.github_repo_full_name,
            github_repo_url: project.github_repo_url,
        },
        scanRun,
    });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { id, scanRunId } = await params;
    const auth = await requireProjectOwnership(id);
    if ("error" in auth) return auth.error;

    const { supabaseAdmin } = auth;
    const strictEnforcement = isScanStrictEnforcementEnabled();
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    let updates: Record<string, unknown> | null = null;
    const now = new Date().toISOString();

    if (action === "dismiss") {
        updates = {
            fix_status: "dismissed",
            fix_dismissed_at: now,
            fix_done_at: null,
        };
    } else if (action === "done") {
        updates = {
            fix_status: "done",
            fix_done_at: now,
        };
    } else if (action === "reopen") {
        updates = {
            fix_status: "pending",
            fix_dismissed_at: null,
            fix_done_at: null,
        };
    }

    if (!updates) {
        return NextResponse.json(
            { error: "Invalid action. Supported actions: dismiss, done, reopen" },
            { status: 400 }
        );
    }

    const { data: previousScanRun, error: previousRunError } = await supabaseAdmin
        .from("scan_runs")
        .select("*")
        .eq("id", scanRunId)
        .eq("project_id", id)
        .single();

    if (previousRunError || !previousScanRun) {
        return NextResponse.json({ error: "Scan run not found" }, { status: 404 });
    }

    const { data: scanRun, error: updateError } = await supabaseAdmin
        .from("scan_runs")
        .update(updates)
        .eq("id", scanRunId)
        .eq("project_id", id)
        .select("*")
        .single();

    if (updateError || !scanRun) {
        return NextResponse.json({ error: "Failed to update fix workflow status" }, { status: 500 });
    }

    // Persist memory context for RAG so follow-up chat can use user decisions.
    const { project } = auth;
    const repo = project.github_repo_full_name ?? id;
    const issueCount = Array.isArray(scanRun.results?.issues) ? scanRun.results.issues.length : 0;

    if (action === "dismiss") {
        const memoryContent = `User dismissed scan run ${scanRunId.slice(0, 8)} for ${repo}. ` +
            `${issueCount > 0 ? `${issueCount} issue(s) were found.` : ""} Marked as not applicable.`;
        try {
            await writeMemory(id, auth.user.id, memoryContent, "dismiss", supabaseAdmin, scanRunId, {
                enforce: strictEnforcement,
            });
        } catch (err) {
            console.error("[Fix Workflow] Failed to persist dismiss memory:", err);
            if (strictEnforcement) {
                await supabaseAdmin
                    .from("scan_runs")
                    .update({
                        fix_status: previousScanRun.fix_status,
                        fix_dismissed_at: previousScanRun.fix_dismissed_at,
                        fix_done_at: previousScanRun.fix_done_at,
                    })
                    .eq("id", scanRunId)
                    .eq("project_id", id);

                const code = err instanceof ScanMemoryError ? err.code : "write_failed";
                return NextResponse.json(
                    { error: "Failed to persist RAG memory for dismiss action", code },
                    { status: 503 }
                );
            }
        }
    } else if (action === "done") {
        const prUrl = typeof scanRun.fix_pr_url === "string" ? scanRun.fix_pr_url : "(no PR URL)";
        const branchName = typeof scanRun.fix_branch_name === "string" ? scanRun.fix_branch_name : "";
        const memoryContent = `User marked fixes as done for ${repo}. ` +
            `${branchName ? `Branch: ${branchName}. ` : ""}PR: ${prUrl}.`;
        try {
            await writeMemory(id, auth.user.id, memoryContent, "done", supabaseAdmin, scanRunId, {
                enforce: strictEnforcement,
            });
        } catch (err) {
            console.error("[Fix Workflow] Failed to persist done memory:", err);
            if (strictEnforcement) {
                await supabaseAdmin
                    .from("scan_runs")
                    .update({
                        fix_status: previousScanRun.fix_status,
                        fix_dismissed_at: previousScanRun.fix_dismissed_at,
                        fix_done_at: previousScanRun.fix_done_at,
                    })
                    .eq("id", scanRunId)
                    .eq("project_id", id);

                const code = err instanceof ScanMemoryError ? err.code : "write_failed";
                return NextResponse.json(
                    { error: "Failed to persist RAG memory for done action", code },
                    { status: 503 }
                );
            }
        }
    }

    return NextResponse.json({ scanRun });
}
