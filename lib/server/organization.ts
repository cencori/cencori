import "server-only";

import { cache } from "react";
import { createServerClient } from "@/lib/supabaseServer";

export interface OrganizationMeta {
  id: string;
  name: string;
  slug: string;
}

/**
 * Per-request deduplicated org lookup for server components.
 *
 * generateMetadata, layouts, and pages in the same request tree each need
 * the org row — without React.cache() every one of them issues its own
 * round trip for identical data.
 */
export const getOrganizationMeta = cache(
  async (slug: string): Promise<OrganizationMeta | null> => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  },
);
