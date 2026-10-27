import "server-only";

import { cache } from "react";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createServerClient } from "@/lib/supabaseServer";
import { withSupabaseRetry } from "@/lib/supabase-retry";

export interface StudioAgent {
    id: string;
    name: string;
    /** Live: published and switched on. */
    live: boolean;
}

export interface StudioWorkspace {
    user: { id: string; firstName: string | null; email: string | null };
    organization: { id: string; name: string; slug: string; isBusiness: boolean };
    project: { id: string; name: string; slug: string };
    agents: StudioAgent[];
}

/**
 * The business Studio shows: the signed-in user's business organization
 * (else their first one), its first project, and that project's agents. All
 * reads go through the user's own access rules. Null when they have no
 * project yet, which is what setup is for.
 */
export const getStudioWorkspace = cache(async (): Promise<StudioWorkspace | null> => {
    const supabase = await createServerClient();
    const { data: { user } } = await withSupabaseRetry(() => getAuthUser(supabase), { operation: "studio auth.getUser" });
    if (!user) return null;

    const { data: organizations } = await withSupabaseRetry(
        () => supabase.from("organizations").select("id, name, slug, account_type, created_at").order("created_at", { ascending: true }),
        { operation: "studio organizations" },
    );
    const list = (organizations ?? []) as Array<{ id: string; name: string; slug: string; account_type?: string | null }>;
    const organization = list.find((item) => item.account_type === "business") ?? list[0];
    if (!organization) return null;

    const { data: project } = await withSupabaseRetry(
        () => supabase.from("projects").select("id, name, slug").eq("organization_id", organization.id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
        { operation: "studio project" },
    );
    if (!project) return null;

    const { data: agents } = await supabase
        .from("agents")
        .select("id, name, is_active, stable_version_id, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true });

    const metadata = (user.user_metadata ?? {}) as Record<string, string | undefined>;
    const firstName = metadata.first_name || metadata.given_name || metadata.name?.split(" ")[0] || null;
    return {
        user: { id: user.id, firstName, email: user.email ?? null },
        organization: { id: organization.id, name: organization.name, slug: organization.slug, isBusiness: organization.account_type === "business" },
        project: { id: project.id as string, name: project.name as string, slug: project.slug as string },
        agents: ((agents ?? []) as Array<{ id: string; name: string; is_active: boolean | null; stable_version_id: string | null }>).map((agent) => ({
            id: agent.id,
            name: agent.name,
            live: !!agent.is_active && !!agent.stable_version_id,
        })),
    };
});
