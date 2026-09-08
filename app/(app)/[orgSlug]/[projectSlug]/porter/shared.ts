"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

/**
 * One Porter, read once, shared by every page of the workspace.
 *
 * The pages are separate routes rather than tabs so the sidebar can say where you are, but they are
 * all views of a single row. The query key names the shape it fetches: staleTime is five minutes
 * and refetchOnMount is off, so widening the select without changing the key serves the narrower
 * cached row and the new columns render as absent.
 */

export type PorterAction = { type?: string; to?: string; source?: string };

export type Porter = {
    id: string;
    name: string;
    greeting: string | null;
    model: string | null;
    source_url: string;
    enabled: boolean;
    surface: string;
    created_at: string;
    system_prompt: string | null;
    publishable_key: string | null;
    collection_id: string | null;
    brand: { color?: string; logo?: string } | null;
    brand_overrides: Record<string, unknown> | null;
    actions: PorterAction[] | null;
};

export function usePorter(orgSlug: string, projectSlug: string) {
    return useQuery({
        queryKey: ["porter", orgSlug, projectSlug, "workspace-v3"],
        queryFn: async (): Promise<Porter | null> => {
            const { data: project } = await supabase
                .from("projects")
                .select("id, organizations!inner(slug)")
                .eq("slug", projectSlug)
                .eq("organizations.slug", orgSlug)
                .maybeSingle();

            if (!project) return null;

            const { data } = await supabase
                .from("porters")
                .select(
                    "id, name, greeting, model, source_url, enabled, surface, created_at, system_prompt, publishable_key, collection_id, brand, brand_overrides, actions"
                )
                .eq("project_id", project.id)
                .maybeSingle();

            return (data as Porter) ?? null;
        },
    });
}

export const PORTER_QUERY_KEY = (orgSlug: string, projectSlug: string) =>
    ["porter", orgSlug, projectSlug, "workspace-v3"] as const;

export function snippetFor(porter: Porter): string | null {
    if (!porter.publishable_key) return null;
    return `<script src="https://cdn.cencori.com/porter.js"
        data-porter="${porter.id}"
        data-key="${porter.publishable_key}"
        defer></script>`;
}

export function hostOf(porter: Porter | null | undefined): string {
    return (porter?.source_url || "").replace(/^https?:\/\//, "");
}
