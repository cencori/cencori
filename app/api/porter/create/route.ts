import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createPorterForProject, parseSiteUrl } from "@/lib/porter/provision";
import { trackEvent } from "@/lib/track-event";

export const runtime = "nodejs";
// The homepage is read before anything is created, against a server that is not ours to hurry.
export const maxDuration = 60;

/**
 * Add a Porter to a project that already exists.
 *
 * Onboarding creates an organization, a project and a Porter together for someone who arrived to
 * buy one. This is the other way in: a developer who came for the gateway, found Porter in the
 * sidebar, and wants one on the project they already have. Same Porter, same inference, same
 * domain-locked key -- the only difference is what already existed when they got here.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await createServerClient();
        const { data: { user }, error: userError } = await session.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json()) as { projectId?: unknown; siteUrl?: unknown };

        if (typeof body.projectId !== "string" || typeof body.siteUrl !== "string") {
            return NextResponse.json({ error: "A project and a site URL are required." }, { status: 400 });
        }

        const parsed = parseSiteUrl(body.siteUrl);
        if (!parsed) {
            return NextResponse.json(
                { error: "That doesn't look like a website address. Try something like acme.com" },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        const { data: project } = await admin
            .from("projects")
            .select("id, organization_id")
            .eq("id", body.projectId)
            .maybeSingle();

        if (!project) {
            return NextResponse.json({ error: "Project not found." }, { status: 404 });
        }

        const { data: membership } = await admin
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", project.organization_id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // One Porter per project, enforced by a unique index. Saying so is friendlier than letting
        // the database refuse with a constraint name.
        const { data: existing } = await admin
            .from("porters")
            .select("id")
            .eq("project_id", project.id)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: "This project already has a Porter." },
                { status: 409 }
            );
        }

        const result = await createPorterForProject(admin, {
            organizationId: project.organization_id,
            projectId: project.id,
            host: parsed.host,
        });

        if ("error" in result) {
            return NextResponse.json(
                process.env.NODE_ENV === "production"
                    ? { error: result.error }
                    : { error: result.error, detail: result.detail },
                { status: 500 }
            );
        }

        trackEvent({
            event_type: "porter.created",
            product: "porter",
            user_id: user.id,
            organization_id: project.organization_id,
            project_id: project.id,
            metadata: { porter_id: result.porter.porterId, host: result.porter.host },
        });

        return NextResponse.json(result.porter);
    } catch (error) {
        console.error("[Porter create] failed:", error);
        return NextResponse.json({ error: "Could not create a Porter." }, { status: 500 });
    }
}
