import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { slugify } from "@/lib/utils";
import { isReservedSlug, isReservedProjectSlug } from "@/lib/reserved-slugs";
import { trackEvent } from "@/lib/track-event";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { inferPorterFromSite } from "@/lib/porter/inference";

/**
 * Provision everything a Porter needs from a single URL.
 *
 * The developer path asks for an organization name and a plan; this one asks for
 * neither. A Porter customer is buying an agent for their website, and every
 * object the platform needs -- organization, membership, project, publishable key
 * -- can be derived from the address they already typed. They are never made to
 * learn what a project is.
 *
 * This runs on the server rather than in the onboarding component because a
 * publishable key has to be generated and hashed with node crypto, and because a
 * half-provisioned account is worse than a failed one: each step below unwinds
 * what it created if the next one fails.
 */

type PorterProvisionRequest = {
    siteUrl?: unknown;
};

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Region is required in practice even though the column is nullable: its default of 'auto' is not
 * a value projects_region_check accepts, so omitting it inserts a row the constraint then rejects.
 * 'europe' is the general group most of the estate already uses, and a general group is the honest
 * choice when a site's address tells us nothing about where its customers are.
 */
const DEFAULT_PROJECT_REGION = "europe";

/**
 * Outside production, hand the database's own words back to the caller. Provisioning touches four
 * tables and the failure the customer sees is deliberately vague; while this is being built, the
 * reason belongs on screen rather than only in a server log nobody is watching.
 */
function withDetail(message: string, detail?: string): { error: string; detail?: string } {
    if (process.env.NODE_ENV === "production" || !detail) return { error: message };
    return { error: message, detail };
}

/** Accept "acme.com", "acme.com/help", or a full URL, and reject anything that isn't web. */
function parseSiteUrl(raw: string): { host: string } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const host = url.hostname.toLowerCase();
    // A hostname with no dot is either localhost or a typo; neither can host a Porter.
    if (!host.includes(".") || host.endsWith(".")) return null;

    return { host };
}

/**
 * "shop.acme-bank.com" -> "Acme Bank". The registrable label is the closest thing a URL carries to
 * a company name on its own, and it is the fallback when the page itself will not say.
 */
function organizationNameFromHost(host: string): string {
    const withoutWww = host.replace(/^www\./, "");
    const labels = withoutWww.split(".");
    // Prefer the label before the public suffix: acme.com -> acme, acme.co.uk -> acme.
    const label = labels.length > 2 ? labels[labels.length - 3] : labels[0];
    const words = label.split(/[-_]+/).filter(Boolean);
    if (words.length === 0) return withoutWww;
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** Both spellings, because the browser sends whichever one the visitor typed. */
function allowedDomainsForHost(host: string): string[] {
    const bare = host.replace(/^www\./, "");
    return Array.from(new Set([bare, `www.${bare}`]));
}

async function findFreeOrganizationSlug(supabase: AdminClient, candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
        if (!candidate || isReservedSlug(candidate)) continue;

        const { data, error } = await supabase
            .from("organizations")
            .select("slug")
            .eq("slug", candidate)
            .maybeSingle();

        if (error) return null;
        if (!data) return candidate;
    }
    return null;
}

/**
 * A project is named after the site it serves. Since 20260905 a project slug only has to be unique
 * inside its organization, so the obvious name is available rather than taken by whoever registered
 * first -- and the URL reads /{person}/{site} the way a deployment dashboard does, instead of
 * repeating one name twice or trailing a number nobody chose.
 */
async function findFreeProjectSlug(
    supabase: AdminClient,
    organizationId: string,
    candidates: string[]
): Promise<string | null> {
    for (const candidate of candidates) {
        if (!candidate || isReservedProjectSlug(candidate)) continue;

        const { data, error } = await supabase
            .from("projects")
            .select("slug")
            .eq("organization_id", organizationId)
            .eq("slug", candidate)
            .maybeSingle();

        if (error) return null;
        if (!data) return candidate;
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        // Who is asking comes from their session; what gets written goes through the service role.
        // Provisioning has to create an organization, a membership, a project and a Porter as one
        // act, and the RLS on projects requires a membership that does not exist until midway
        // through -- so the sequence cannot be expressed as four authenticated client calls.
        // Authorization is not weakened by this: everything created below is owned by this user.
        const session = await createServerClient();
        const { data: { user }, error: userError } = await session.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createAdminClient();

        const body = (await request.json()) as PorterProvisionRequest;
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

        // Read the homepage before deciding what anything is called. Everything this returns is
        // optional: a site that will not load leaves the hostname-derived name in place.
        const inferred = await inferPorterFromSite(`https://${host}`, host);
        const siteName = inferred.name?.slice(0, 80) || organizationNameFromHost(host);
        const siteSlug = slugify(siteName) || slugify(host.replace(/^www\./, "").split(".")[0]);

        // The organization is the person and the project is the site, which is the shape a
        // deployment dashboard uses: /{who}/{what}. Naming the organization after the site instead
        // produces /stripe/stripe, and leaves nowhere sensible to put a second site later.
        const personName = String(
            user.user_metadata?.full_name || user.user_metadata?.name || ""
        ).trim();
        const organizationName = personName || siteName;
        const organizationSlug = await findFreeOrganizationSlug(supabase, [
            slugify(organizationName),
            // Meaningful before numeric: someone's name taken by another account should fall to
            // their site, not to a suffix they did not choose.
            `${slugify(organizationName)}-${siteSlug}`,
            siteSlug,
            ...Array.from({ length: 6 }, (_, i) => `${slugify(organizationName)}-${i + 2}`),
        ]);
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

        const projectSlug = await findFreeProjectSlug(supabase, organization.id, [
            siteSlug,
            `${siteSlug}-site`,
            ...Array.from({ length: 6 }, (_, i) => `${siteSlug}-${i + 2}`),
        ]);
        if (!projectSlug) {
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json(
                withDetail("Could not prepare your workspace.", "no free project slug after 10 attempts"),
                { status: 409 }
            );
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
            return NextResponse.json(
                withDetail("Could not prepare your workspace.", projectError?.message),
                { status: 500 }
            );
        }

        // The key ships in the page source of the customer's site, so it is domain
        // locked at creation: gateway-middleware rejects it from any other origin.
        const allowedDomains = allowedDomainsForHost(host);
        const keyPrefix = "cpk_";
        const apiKey = generateApiKey(keyPrefix);

        const { error: keyError } = await supabase.from("api_keys").insert({
            project_id: project.id,
            name: `Porter (${host})`,
            key_hash: hashApiKey(apiKey),
            key_prefix: apiKey.substring(0, keyPrefix.length + 4) + "...",
            environment: "production",
            key_type: "publishable",
            allowed_domains: allowedDomains,
        });

        if (keyError) {
            console.error("[Porter onboarding] key insert failed:", keyError.message);
            await supabase.from("projects").delete().eq("id", project.id);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json(withDetail("Could not prepare your Porter.", keyError.message), { status: 500 });
        }

        // The Porter itself. Disabled until its site has been read -- answering before the crawl
        // would be worse than not answering at all.
        const { data: porter, error: porterError } = await supabase
            .from("porters")
            .insert({
                project_id: project.id,
                organization_id: organization.id,
                name: siteName,
                source_url: `https://${host}`,
                system_prompt: inferred.systemPrompt ?? null,
                enabled: false,
                surface: "launcher",
                // Inferred values only. What the customer edits later lands in brand_overrides, so
                // a re-crawl can refresh this without undoing anything they chose.
                brand: inferred.brand,
                actions: inferred.contactEmail
                    ? [{ type: "email", to: inferred.contactEmail, source: "inferred" }]
                    : [],
            })
            .select("id")
            .single();

        if (porterError || !porter) {
            console.error("[Porter onboarding] porter insert failed:", porterError?.message);
            await supabase.from("projects").delete().eq("id", project.id);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json(withDetail("Could not prepare your Porter.", porterError?.message), { status: 500 });
        }

        trackEvent({
            event_type: "onboarding.porter_provisioned",
            product: "porter",
            user_id: user.id,
            organization_id: organization.id,
            project_id: project.id,
            metadata: {
                host,
                allowed_domains: allowedDomains,
                porter_id: porter.id,
                inferred_name: Boolean(inferred.name),
                inferred_brand_color: Boolean(inferred.brand.color),
                inferred_contact: Boolean(inferred.contactEmail),
            },
        });

        return NextResponse.json({
            porterId: porter.id,
            organizationSlug: organization.slug,
            projectSlug: project.slug,
            organizationName: organization.name,
            host,
            // Publishable by definition -- this is the value that goes in the snippet.
            publishableKey: apiKey,
        });
    } catch (error) {
        console.error("[Porter onboarding] unexpected failure:", error);
        return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
}
