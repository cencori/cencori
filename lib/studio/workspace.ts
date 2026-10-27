import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createServerClient } from "@/lib/supabaseServer";
import { withSupabaseRetry } from "@/lib/supabase-retry";

export interface StudioAgent {
    id: string;
    name: string;
    /** Live: published and switched on. */
    live: boolean;
    /** Published at least once: setup got it all the way (it may be switched off since). */
    published: boolean;
}

/** The cookie that remembers which business Studio shows, for people in more than one. */
export const STUDIO_ORG_COOKIE = "studio_org";

export interface StudioWorkspace {
    user: { id: string; firstName: string | null; fullName: string | null; email: string | null; avatarUrl: string | null };
    organization: { id: string; name: string; slug: string; isBusiness: boolean };
    /** Every organization the user belongs to that has a project, for switching. */
    organizations: Array<{ id: string; name: string }>;
    project: { id: string; name: string; slug: string };
    agents: StudioAgent[];
}

/**
 * The business Studio shows: the one they last picked, else the signed-in
 * user's business organization (else their first one), its first project, and that project's agents. All
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
    const all = (organizations ?? []) as Array<{ id: string; name: string; slug: string; account_type?: string | null }>;
    if (all.length === 0) return null;

    // Each organization's first project; one without a project has nothing to show.
    const { data: projects } = await withSupabaseRetry(
        () => supabase.from("projects").select("id, name, slug, organization_id").in("organization_id", all.map((item) => item.id)).order("created_at", { ascending: true }),
        { operation: "studio projects" },
    );
    const firstProject = new Map<string, { id: string; name: string; slug: string }>();
    for (const item of (projects ?? []) as Array<{ id: string; name: string; slug: string; organization_id: string }>) {
        if (!firstProject.has(item.organization_id)) firstProject.set(item.organization_id, { id: item.id, name: item.name, slug: item.slug });
    }
    const list = all.filter((item) => firstProject.has(item.id));

    const picked = (await cookies()).get(STUDIO_ORG_COOKIE)?.value;
    const organization = list.find((item) => item.id === picked)
        ?? list.find((item) => item.account_type === "business")
        ?? list[0];
    if (!organization) return null;
    const project = firstProject.get(organization.id)!;

    const { data: agents } = await supabase
        .from("agents")
        .select("id, name, is_active, stable_version_id, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true });

    // The photo they set in the console wins over the one from their sign-in provider.
    const { data: profile } = await supabase.from("user_profiles").select("avatar_url").eq("id", user.id).maybeSingle();

    const metadata = (user.user_metadata ?? {}) as Record<string, string | undefined>;
    const fullName = metadata.full_name || metadata.name || [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") || null;
    const firstName = metadata.first_name || metadata.given_name || fullName?.split(" ")[0] || null;
    return {
        user: { id: user.id, firstName, fullName, email: user.email ?? null, avatarUrl: (profile?.avatar_url as string | null | undefined) || metadata.avatar_url || metadata.picture || null },
        organization: { id: organization.id, name: organization.name, slug: organization.slug, isBusiness: organization.account_type === "business" },
        organizations: list.map((item) => ({ id: item.id, name: item.name })),
        project,
        agents: ((agents ?? []) as Array<{ id: string; name: string; is_active: boolean | null; stable_version_id: string | null }>).map((agent) => ({
            id: agent.id,
            name: agent.name,
            live: !!agent.is_active && !!agent.stable_version_id,
            published: !!agent.stable_version_id,
        })),
    };
});
