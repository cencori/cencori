import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { slugify } from "@/lib/utils";
import { isReservedSlug, isReservedProjectSlug } from "@/lib/reserved-slugs";
import { trackEvent } from "@/lib/track-event";
import { createPorterForProject, nameFromHost, parseSiteUrl } from "@/lib/porter/provision";

/**
 * Provision an account and a Porter from a single URL.
 *
 * The developer path asks for an organization name and a plan; this one asks for neither. Every
 * object the platform needs -- organization, membership, project, key, Porter -- is derived from the
 * address the customer already typed, and they are never made to learn what a project is.
 *
 * Naming follows the same rule as the console rather than a scheme of its own: slugify the name,
 * and add a number if it is taken. The organization is the person and the project is the site, so
 * the URL reads /{who}/{what}, but nothing about how a slug is chosen is special here.
 *
 * Runs on the server because a publishable key needs node crypto, and because a half-provisioned
 * account is worse than a failed one: each step unwinds what it created if the next one fails.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Region is required in practice even though the column is nullable: its default of 'auto' is not a
 * value projects_region_check accepts, so omitting it inserts a row the constraint then rejects.
 */
const DEFAULT_PROJECT_REGION = "europe";

/** Outside production, hand the database's own words back rather than only to a server log. */
function withDetail(message: string, detail?: string): { error: string; detail?: string } {
    if (process.env.NODE_ENV === "production" || !detail) return { error: message };
    return { error: message, detail };
}

/**
 * slugify, then fall back if it is taken.
 *
 * A word before a number, where there is a sensible one: stripe-project reads like a name somebody
 * chose and stripe-2 reads like a queue position. Numbers still follow, because the word can be
 * taken too, but they are the last resort rather than the first.
 */
async function findFreeSlug(
    base: string,
    isReserved: (slug: string) => boolean,
    isTaken: (slug: string) => Promise<boolean | null>,
    preferred?: string,
): Promise<string | null> {
    const root = base || "porter";
    const candidates = [
        root,
        ...(preferred ? [`${root}-${preferred}`] : []),
        ...Array.from({ length: 8 }, (_, i) => `${root}-${i + 2}`),
    ];

    for (const candidate of candidates) {
        if (isReserved(candidate)) continue;
        const taken = await isTaken(candidate);
        if (taken === null) return null;
        if (!taken) return candidate;
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        // Who is asking comes from their session; what gets written goes through the service role.
        // Provisioning creates an organization, a membership, a project and a Porter as one act, and
        // the RLS on projects requires a membership that does not exist until midway through -- so
        // the sequence cannot be expressed as authenticated client calls. Authorization is not
        // weakened: everything created below is owned by this user.
        const session = await createServerClient();
        const { data: { user }, error: userError } = await session.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase: AdminClient = createAdminClient();

        const body = (await request.json()) as { siteUrl?: unknown };
        if (typeof body.siteUrl !== "string") {
            return NextResponse.json({ error: "A site URL is required." }, { status: 400 });
        }

        const parsed = parseSiteUrl(body.siteUrl);
        if (!parsed) {
            return NextResponse.json(
                { error: "That doesn't look like a website address. Try something like acme.com" },
                { status: 400 }
            );
        }
        const { host } = parsed;

        const siteName = nameFromHost(host);
        const personName = String(
            user.user_metadata?.full_name || user.user_metadata?.name || ""
        ).trim();
        const organizationName = personName || siteName;

        const organizationSlug = await findFreeSlug(
            slugify(organizationName),
            isReservedSlug,
            async (slug) => {
                const { data, error } = await supabase
                    .from("organizations").select("slug").eq("slug", slug).maybeSingle();
                return error ? null : Boolean(data);
            },
        );
        if (!organizationSlug) {
            return NextResponse.json({ error: "Could not prepare your account. Please try again." }, { status: 409 });
        }

        const { data: organization, error: organizationError } = await supabase
            .from("organizations")
            .insert({
                name: organizationName,
                slug: organizationSlug,
                subscription_tier: "free",
                subscription_status: "active",
                monthly_requests_used: 0,
                owner_id: user.id,
            })
            .select("id, slug, name")
            .single();

        if (organizationError || !organization) {
            console.error("[Porter onboarding] organization insert failed:", organizationError?.message);
            return NextResponse.json(withDetail("Could not create your account.", organizationError?.message), { status: 500 });
        }

        const { error: memberError } = await supabase
            .from("organization_members")
            .insert({ organization_id: organization.id, user_id: user.id, role: "owner" });

        if (memberError) {
            console.error("[Porter onboarding] membership insert failed:", memberError.message);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json(withDetail("Could not finish setting up your account.", memberError.message), { status: 500 });
        }

        const projectSlug = await findFreeSlug(
            slugify(siteName),
            isReservedProjectSlug,
            async (slug) => {
                const { data, error } = await supabase
                    .from("projects").select("slug")
                    .eq("organization_id", organization.id).eq("slug", slug).maybeSingle();
                return error ? null : Boolean(data);
            },
            "project",
        );
        if (!projectSlug) {
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json(withDetail("Could not prepare your workspace."), { status: 409 });
        }

        const { data: project, error: projectError } = await supabase
            .from("projects")
            .insert({
                name: siteName,
                slug: projectSlug,
                description: `Porter for ${host}`,
                organization_id: organization.id,
                visibility: "private",
                region: DEFAULT_PROJECT_REGION,
            })
            .select("id, slug")
            .single();

        if (projectError || !project) {
            console.error("[Porter onboarding] project insert failed:", projectError?.message);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json(withDetail("Could not prepare your workspace.", projectError?.message), { status: 500 });
        }

        // The same call the console makes when a project that already exists gains a Porter.
        const result = await createPorterForProject(supabase, {
            organizationId: organization.id,
            projectId: project.id,
            host,
        });

        if ("error" in result) {
            await supabase.from("projects").delete().eq("id", project.id);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json(withDetail(result.error, result.detail), { status: 500 });
        }

        trackEvent({
            event_type: "onboarding.porter_provisioned",
            product: "porter",
            user_id: user.id,
            organization_id: organization.id,
            project_id: project.id,
            metadata: {
                host,
                porter_id: result.porter.porterId,
                allowed_domains: result.porter.allowedDomains,
            },
        });

        return NextResponse.json({
            porterId: result.porter.porterId,
            organizationSlug: organization.slug,
            projectSlug: project.slug,
            organizationName: organization.name,
            host,
            publishableKey: result.porter.publishableKey,
        });
    } catch (error) {
        console.error("[Porter onboarding] unexpected failure:", error);
        return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
}
