import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { discoverPorterLinks } from "@/lib/porter/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Ask a site what it contains, before reading any of it.
 *
 * A Porter has a page allowance, and crawling first spends it on whatever the crawler reached
 * rather than on what the customer would have chosen. This returns the addresses grouped by
 * section, so the answer to "87 pages under /changelog" can be no.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ porterId: string }> }
) {
    try {
        const { porterId } = await params;

        const session = await createServerClient();
        const { data: { user }, error: userError } = await session.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const admin = createAdminClient();

        const { data: porter } = await admin
            .from("porters")
            .select("id, organization_id, source_url")
            .eq("id", porterId)
            .maybeSingle();

        if (!porter) {
            return NextResponse.json({ error: "Porter not found." }, { status: 404 });
        }

        const { data: membership } = await admin
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", porter.organization_id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        let host: string;
        try {
            host = new URL(porter.source_url).hostname.toLowerCase();
        } catch {
            return NextResponse.json({ error: "This Porter has no valid site." }, { status: 409 });
        }

        const found = await discoverPorterLinks(host);

        return NextResponse.json(found);
    } catch (error) {
        console.error("[Porter discover] failed:", error);
        return NextResponse.json({ error: "Could not read that site." }, { status: 500 });
    }
}
