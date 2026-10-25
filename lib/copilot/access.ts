import type { createAdminClient } from "@/lib/supabaseAdmin";

/** The organization if the user owns it or is a member of it; null otherwise. */
export async function verifyOrganizationAccess(
    organizationId: string,
    userId: string,
    admin: ReturnType<typeof createAdminClient>,
) {
    const { data: organization } = await admin
        .from("organizations")
        .select("id, name, slug, owner_id, subscription_tier")
        .eq("id", organizationId)
        .maybeSingle();

    if (!organization) return null;
    if (organization.owner_id === userId) return organization;

    const { data: membership } = await admin
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .maybeSingle();

    return membership ? organization : null;
}
