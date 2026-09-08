import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { PORTER_SESSION_TTL_SECONDS, isSessionSigningConfigured, mintPorterSession } from "@/lib/porter/session";

export const runtime = "nodejs";

/**
 * A session for testing a Porter from the console.
 *
 * The public endpoint checks a publishable key and the request's origin, because the caller is a
 * stranger on a customer's website. Here the caller is signed in and a member of the organization
 * that owns the Porter, which is a stronger claim than any header -- so the origin check would only
 * mean asking a customer to add cencori.com to their own allowed domains to test their own Porter.
 *
 * The token is otherwise identical, so a preview exercises the same path a visitor gets rather than
 * a friendlier one that hides what they would actually see.
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ porterId: string }> }
) {
    const { porterId } = await params;

    if (!isSessionSigningConfigured()) {
        return NextResponse.json({ error: "Sessions are unavailable." }, { status: 503 });
    }

    const session = await createServerClient();
    const { data: { user }, error: userError } = await session.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: porter } = await admin
        .from("porters")
        .select("id, organization_id, project_id, source_url, enabled")
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

    if (!porter.enabled) {
        return NextResponse.json(
            { error: "This Porter has not read its site yet.", code: "porter_not_ready" },
            { status: 409 }
        );
    }

    let host = "";
    try {
        host = new URL(porter.source_url).hostname.toLowerCase();
    } catch {
        host = "";
    }

    const token = mintPorterSession({
        p: porter.id as string,
        j: porter.project_id as string,
        h: host,
    });

    if (!token) {
        return NextResponse.json({ error: "Sessions are unavailable." }, { status: 503 });
    }

    return NextResponse.json({ token, expiresIn: PORTER_SESSION_TTL_SECONDS });
}
