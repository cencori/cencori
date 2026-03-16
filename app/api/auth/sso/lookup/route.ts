import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// POST — check if an email domain has SSO configured
export async function POST(req: NextRequest) {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
        return NextResponse.json({ sso: false });
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
        return NextResponse.json({ sso: false });
    }

    const admin = createAdminClient();

    // Check if the domain has an SSO-enabled organization
    const { data: org } = await admin
        .from("organizations")
        .select("id, name, sso_domain, sso_enforce")
        .eq("sso_domain", domain)
        .eq("sso_enabled", true)
        .single();

    if (!org) {
        return NextResponse.json({ sso: false });
    }

    return NextResponse.json({
        sso: true,
        enforce: org.sso_enforce,
        organization: org.name,
        domain: org.sso_domain,
    });
}
