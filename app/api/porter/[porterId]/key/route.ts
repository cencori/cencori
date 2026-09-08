import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { trackEvent } from "@/lib/track-event";

export const runtime = "nodejs";

/**
 * Issue the key a Porter's snippet needs.
 *
 * Provisioning already mints one, so this exists for the two cases where it is missing: a Porter
 * created before the key was kept, and a customer who wants the old one to stop working.
 *
 * The previous key is deleted rather than left alongside. A Porter has one snippet, and a key that
 * still answers after someone pressed the button that was supposed to replace it is the kind of
 * thing people only discover the hard way.
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
            .select("id, organization_id, project_id, source_url")
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

        const bare = host.replace(/^www\./, "");
        const allowedDomains = Array.from(new Set([bare, `www.${bare}`]));

        const keyPrefix = "cpk_";
        const apiKey = generateApiKey(keyPrefix);

        const { error: insertError } = await admin.from("api_keys").insert({
            project_id: porter.project_id,
            name: `Porter (${host})`,
            key_hash: hashApiKey(apiKey),
            key_prefix: apiKey.substring(0, keyPrefix.length + 4) + "...",
            environment: "production",
            key_type: "publishable",
            client_app: "porter",
            allowed_domains: allowedDomains,
        });

        if (insertError) {
            console.error("[Porter key] insert failed:", insertError.message);
            return NextResponse.json({ error: "Could not issue a key." }, { status: 500 });
        }

        // Replace rather than accumulate: the snippet names one key, so the others should not work.
        const { data: porterRow } = await admin
            .from("porters")
            .select("publishable_key")
            .eq("id", porter.id)
            .maybeSingle();

        if (porterRow?.publishable_key) {
            await admin
                .from("api_keys")
                .delete()
                .eq("project_id", porter.project_id)
                .eq("key_type", "publishable")
                .eq("key_hash", hashApiKey(porterRow.publishable_key));
        }

        await admin.from("porters").update({ publishable_key: apiKey }).eq("id", porter.id);

        trackEvent({
            event_type: "porter.key_issued",
            product: "porter",
            user_id: user.id,
            organization_id: porter.organization_id,
            project_id: porter.project_id,
            metadata: { porter_id: porter.id, host },
        });

        return NextResponse.json({ publishableKey: apiKey, allowedDomains });
    } catch (error) {
        console.error("[Porter key] failed:", error);
        return NextResponse.json({ error: "Could not issue a key." }, { status: 500 });
    }
}
