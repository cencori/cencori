import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { PORTER_MODEL_IDS } from "@/lib/porter/models";

export const runtime = "nodejs";

/**
 * Change a Porter.
 *
 * Only the fields a customer is allowed to set. The prompt, the pages, the guards and the policy
 * are not editable from here -- a Porter that can be told to ignore its own sources is not the
 * product -- so this accepts a short list rather than merging whatever arrives.
 */
export async function PATCH(
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
            .select("id, organization_id")
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

        const body = (await request.json()) as { model?: unknown };
        const patch: Record<string, unknown> = {};

        if ("model" in body) {
            // null is "let Cencori choose", which is what a Porter starts with.
            if (body.model === null) {
                patch.model = null;
            } else if (typeof body.model === "string" && PORTER_MODEL_IDS.includes(body.model)) {
                patch.model = body.model;
            } else {
                return NextResponse.json({ error: "That model is not available." }, { status: 400 });
            }
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
        }

        const { error } = await admin.from("porters").update(patch).eq("id", porter.id);

        if (error) {
            console.error("[Porter patch] failed:", error.message);
            return NextResponse.json({ error: "Could not save that." }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[Porter patch] failed:", error);
        return NextResponse.json({ error: "Could not save that." }, { status: 500 });
    }
}
