"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { supabase } from "@/lib/supabaseClient";
import { useCopilot } from "@/lib/contexts/CopilotContext";
import { getConsoleRoute } from "@/lib/console/routing";
import { useBusinessPlan } from "@/components/dashboard/billing/BusinessPlan";

/**
 * A business's home is never the developer dashboard: with no agent yet it's
 * Copilot (describe the business, it builds the agent), after that its agents.
 * Returns true while it's taking over the page, so the overview stays hidden.
 */
export function useBusinessHome(orgSlug: string, projectSlug: string, projectId: string | null | undefined): boolean {
    const router = useRouter();
    const pathname = usePathname() ?? "";
    const organization = useCopilot()?.agent.organization ?? null;
    const business = useBusinessPlan(organization?.id);
    const isBusiness = business.data?.account_type === "business";
    const agents = useQuery({
        queryKey: ["businessHomeAgents", projectId ?? null],
        enabled: isBusiness && !!projectId,
        queryFn: async () => {
            const { count, error } = await supabase.from("agents").select("id", { count: "exact", head: true }).eq("project_id", projectId!);
            if (error) throw error;
            return count ?? 0;
        },
    });

    useEffect(() => {
        if (!isBusiness || agents.isPending) return;
        const base = getConsoleRoute(pathname) ? "" : `/${orgSlug}/${projectSlug}`;
        router.replace(agents.data === 0 ? `${base}/copilot` : `${base}/agents`);
    }, [agents.data, agents.isPending, isBusiness, orgSlug, pathname, projectSlug, router]);

    // Hold the overview back until we know whose home this is.
    return !!organization && (business.isPending || isBusiness);
}

export function BusinessHomeLoading() {
    return (
        <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="Loading">
            <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    );
}
