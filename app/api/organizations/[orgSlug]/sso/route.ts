import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createSSOProvider, deleteSSOProvider } from "@/lib/supabase-sso";

async function getOrgAsOwnerOrAdmin(orgSlug: string) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Not authenticated", status: 401 };

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug, sso_enabled, sso_provider_id, sso_domain, sso_enforce, sso_configured_at, subscription_tier")
        .eq("slug", orgSlug)
        .single();

    if (!org) return { error: "Organization not found", status: 404 };

    const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return { error: "Insufficient permissions", status: 403 };
    }

    return { org, user };
}

// GET — fetch SSO configuration
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const { orgSlug } = await params;
    const result = await getOrgAsOwnerOrAdmin(orgSlug);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { org } = result;
    return NextResponse.json({
        sso_enabled: org.sso_enabled,
        sso_domain: org.sso_domain,
        sso_enforce: org.sso_enforce,
        sso_provider_id: org.sso_provider_id,
        sso_configured_at: org.sso_configured_at,
        subscription_tier: org.subscription_tier,
    });
}

// POST — configure SSO
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const { orgSlug } = await params;
    const result = await getOrgAsOwnerOrAdmin(orgSlug);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { org, user } = result;

    if (!["enterprise", "team"].includes(org.subscription_tier || "")) {
        return NextResponse.json(
            { error: "SSO is available on Team and Enterprise plans" },
            { status: 403 }
        );
    }

    const body = await req.json();
    const { metadata_url, metadata_xml, domain } = body;

    if (!domain) {
        return NextResponse.json({ error: "Domain is required" }, { status: 400 });
    }
    if (!metadata_url && !metadata_xml) {
        return NextResponse.json(
            { error: "Either metadata_url or metadata_xml is required" },
            { status: 400 }
        );
    }

    try {
        // Remove existing provider if any
        if (org.sso_provider_id) {
            try { await deleteSSOProvider(org.sso_provider_id); } catch {}
        }

        // Create new SAML provider via GoTrue REST API
        const providerParams: any = {
            type: "saml" as const,
            domains: [domain],
        };
        if (metadata_url) providerParams.metadata_url = metadata_url;
        else providerParams.metadata_xml = metadata_xml;

        const provider = await createSSOProvider(providerParams);

        // Save to organization
        const supabase = await createServerClient();
        const { error: updateError } = await supabase
            .from("organizations")
            .update({
                sso_enabled: true,
                sso_provider_id: provider.id,
                sso_domain: domain,
                sso_configured_at: new Date().toISOString(),
                sso_configured_by: user.id,
            })
            .eq("id", org.id);

        if (updateError) {
            await deleteSSOProvider(provider.id);
            return NextResponse.json({ error: "Failed to save SSO configuration" }, { status: 500 });
        }

        return NextResponse.json({
            sso_enabled: true,
            sso_provider_id: provider.id,
            sso_domain: domain,
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || "Failed to configure SSO" },
            { status: 500 }
        );
    }
}

// PATCH — update enforcement
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const { orgSlug } = await params;
    const result = await getOrgAsOwnerOrAdmin(orgSlug);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { org } = result;
    if (!org.sso_enabled) {
        return NextResponse.json(
            { error: "SSO must be configured first" },
            { status: 400 }
        );
    }

    const body = await req.json();
    const supabase = await createServerClient();
    const { error } = await supabase
        .from("organizations")
        .update({ sso_enforce: body.sso_enforce })
        .eq("id", org.id);

    if (error) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ sso_enforce: body.sso_enforce });
}

// DELETE — remove SSO
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const { orgSlug } = await params;
    const result = await getOrgAsOwnerOrAdmin(orgSlug);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { org } = result;
    if (!org.sso_provider_id) {
        return NextResponse.json({ error: "No SSO configured" }, { status: 400 });
    }

    try { await deleteSSOProvider(org.sso_provider_id); } catch {}

    const supabase = await createServerClient();
    await supabase
        .from("organizations")
        .update({
            sso_enabled: false,
            sso_provider_id: null,
            sso_domain: null,
            sso_enforce: false,
            sso_configured_at: null,
            sso_configured_by: null,
        })
        .eq("id", org.id);

    return NextResponse.json({ sso_enabled: false });
}
