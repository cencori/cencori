import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { slugify } from "@/lib/utils";
import { isReservedSlug, isReservedProjectSlug } from "@/lib/reserved-slugs";
import { trackEvent } from "@/lib/track-event";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";

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

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

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
 * "shop.acme-bank.com" -> "Acme Bank". The registrable label is the closest thing
 * to a company name a URL carries on its own. Step 3 replaces this with the real
 * title read from the page; until then it is the name the customer sees, so it is
 * worth getting close rather than falling back to the raw host.
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

async function findFreeOrganizationSlug(supabase: ServerClient, baseSlug: string): Promise<string | null> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
        if (isReservedSlug(candidate)) continue;

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

async function findFreeProjectSlug(
    supabase: ServerClient,
    organizationId: string,
    baseSlug: string
): Promise<string | null> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
        if (isReservedProjectSlug(candidate)) continue;

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
        const supabase = await createServerClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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

        const organizationName = organizationNameFromHost(host);
        const organizationSlug = await findFreeOrganizationSlug(
            supabase,
            slugify(organizationName) || slugify(host) || "porter"
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
            return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
        }

        const { error: memberError } = await supabase
            .from("organization_members")
            .insert({ organization_id: organization.id, user_id: user.id, role: "owner" });

        if (memberError) {
            console.error("[Porter onboarding] membership insert failed:", memberError.message);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json({ error: "Could not finish setting up your account." }, { status: 500 });
        }

        const projectSlug = await findFreeProjectSlug(supabase, organization.id, "production");
        if (!projectSlug) {
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json({ error: "Could not prepare your workspace." }, { status: 409 });
        }

        const { data: project, error: projectError } = await supabase
            .from("projects")
            .insert({
                name: organizationName,
                slug: projectSlug,
                description: `Porter for ${host}`,
                organization_id: organization.id,
                visibility: "private",
            })
            .select("id, slug")
            .single();

        if (projectError || !project) {
            console.error("[Porter onboarding] project insert failed:", projectError?.message);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json({ error: "Could not prepare your workspace." }, { status: 500 });
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
            return NextResponse.json({ error: "Could not prepare your Porter." }, { status: 500 });
        }

        // The Porter itself. Disabled until its site has been read -- answering before the crawl
        // would be worse than not answering at all.
        const { data: porter, error: porterError } = await supabase
            .from("porters")
            .insert({
                project_id: project.id,
                organization_id: organization.id,
                name: organizationName,
                source_url: `https://${host}`,
                enabled: false,
                surface: "launcher",
            })
            .select("id")
            .single();

        if (porterError || !porter) {
            console.error("[Porter onboarding] porter insert failed:", porterError?.message);
            await supabase.from("projects").delete().eq("id", project.id);
            await supabase.from("organizations").delete().eq("id", organization.id);
            return NextResponse.json({ error: "Could not prepare your Porter." }, { status: 500 });
        }

        trackEvent({
            event_type: "onboarding.porter_provisioned",
            product: "porter",
            user_id: user.id,
            organization_id: organization.id,
            project_id: project.id,
            metadata: { host, allowed_domains: allowedDomains, porter_id: porter.id },
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
