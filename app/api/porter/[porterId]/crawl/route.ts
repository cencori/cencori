import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { readPorterSite } from "@/lib/porter/knowledge";
import { trackEvent } from "@/lib/track-event";

export const runtime = "nodejs";
// A shallow crawl of a couple of dozen pages, fetched one at a time, against a site whose speed is
// not ours to control.
export const maxDuration = 120;

/**
 * Read a Porter's site.
 *
 * Provisioning deliberately does not do this. A crawl takes tens of seconds against somebody else's
 * webserver, and signup should not sit behind it -- so the account is created first and the site is
 * read afterwards, which is also what lets the console show it happening rather than spin.
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

        const { data: porter, error: porterError } = await admin
            .from("porters")
            .select("id, organization_id, project_id, source_url")
            .eq("id", porterId)
            .maybeSingle();

        if (porterError || !porter) {
            return NextResponse.json({ error: "Porter not found." }, { status: 404 });
        }

        // Reading someone else's site on their behalf is not something a stranger gets to trigger.
        const { data: membership } = await admin
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", porter.organization_id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const summary = await readPorterSite(admin, porter);

        trackEvent({
            event_type: "porter.site_read",
            product: "porter",
            user_id: user.id,
            organization_id: porter.organization_id,
            project_id: porter.project_id,
            metadata: { porter_id: porter.id, indexed: summary.indexed, skipped: summary.skipped, failed: summary.failed },
        });

        return NextResponse.json({
            indexed: summary.indexed,
            skipped: summary.skipped,
            failed: summary.failed,
            // Enabled only if something was actually indexed; readPorterSite owns that decision.
            answering: summary.indexed > 0,
            pages: summary.pages.slice(0, 50),
        });
    } catch (error) {
        console.error("[Porter crawl] failed:", error);
        const detail = error instanceof Error ? error.message : undefined;
        return NextResponse.json(
            process.env.NODE_ENV === "production"
                ? { error: "Could not read the site." }
                : { error: "Could not read the site.", detail },
            { status: 500 }
        );
    }
}
