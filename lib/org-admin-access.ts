import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createServerClient } from '@/lib/supabaseServer';

/**
 * The signed-in user's owner/admin access to an organization, by slug.
 *
 * Shared by the organization settings actions and by routes that act for an organization
 * (e.g. the CostGraph OAuth start and callback), so every write to org-level configuration
 * applies the same rule.
 */
export async function requireOrgOwnerOrAdmin(orgSlug: string): Promise<
    | { ok: true; orgId: string; userId: string; role: string }
    | { ok: false; error: string; status: number }
> {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await getAuthUser(supabase);
    if (userError || !user) return { ok: false, error: 'Not signed in.', status: 401 };

    const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single();
    if (!org) return { ok: false, error: 'Organization not found.', status: 404 };

    const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .single();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return { ok: false, error: 'You need owner or admin role for this action.', status: 403 };
    }

    return { ok: true, orgId: org.id, userId: user.id, role: membership.role };
}
