/**
 * Shadow Mode — Action Approval Polling
 * 
 * Agent clients poll this endpoint to check if their pending tool calls
 * have been approved or rejected by the user in the dashboard.
 * 
 * GET /api/v1/agent/actions/poll?ids=id1,id2,id3
 * 
 * Returns the status of each action:
 * - pending:  still waiting for user decision
 * - approved: user approved, safe to execute
 * - rejected: user rejected, do NOT execute
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import crypto from "crypto";

export async function GET(req: NextRequest) {
    try {
        // ── Auth (same dual-mode as chat/completions) ──
        const authHeader = req.headers.get("Authorization");
        const apiKey = req.headers.get('CENCORI_API_KEY')
            || (authHeader?.startsWith('Bearer cake_') ? authHeader.replace('Bearer ', '').trim() : null)
            || (authHeader?.startsWith('Bearer cencori_') ? authHeader.replace('Bearer ', '').trim() : null)
            || (authHeader?.startsWith('Bearer cen_') ? authHeader.replace('Bearer ', '').trim() : null);

        if (!apiKey && !authHeader) {
            return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
        }

        if (apiKey) {
            // Quick key validation
            const adminClient = createAdminClient();
            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            const { data, error } = await adminClient
                .from('api_keys')
                .select('id')
                .eq('key_hash', keyHash)
                .is('revoked_at', null)
                .single();
            if (error || !data) {
                return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
            }
        }

        // ── Parse action IDs ──
        const idsParam = req.nextUrl.searchParams.get("ids");
        if (!idsParam) {
            return NextResponse.json({ error: "Missing 'ids' query parameter" }, { status: 400 });
        }

        const ids = idsParam.split(",").filter(Boolean);
        if (ids.length === 0 || ids.length > 20) {
            return NextResponse.json({ error: "Provide 1-20 action IDs" }, { status: 400 });
        }

        // ── Fetch action statuses ──
        const adminClient = createAdminClient();
        const { data: actions, error: fetchError } = await adminClient
            .from("agent_actions")
            .select("id, status, payload, approved_at")
            .in("id", ids);

        if (fetchError) {
            return NextResponse.json({ error: "Failed to fetch actions" }, { status: 500 });
        }

        // Build response map
        const statusMap: Record<string, {
            status: string;
            approved_at: string | null;
            tool?: string;
        }> = {};

        for (const action of actions || []) {
            statusMap[action.id] = {
                status: action.status,
                approved_at: action.approved_at,
                tool: action.payload?.tool,
            };
        }

        // Check if all are resolved (no longer pending)
        const allResolved = Object.values(statusMap).every(a => a.status !== 'pending');
        const anyRejected = Object.values(statusMap).some(a => a.status === 'rejected');

        return NextResponse.json({
            actions: statusMap,
            all_resolved: allResolved,
            any_rejected: anyRejected,
            // If still pending, suggest a retry interval
            ...(allResolved ? {} : { retry_after_ms: 2000 }),
        });

    } catch (error: any) {
        console.error("Poll Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
