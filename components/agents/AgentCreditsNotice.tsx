"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useCopilot } from "@/lib/contexts/CopilotContext";
import { getConsoleRoute } from "@/lib/console/routing";
import { Button } from "@/components/ui/button";

/**
 * An agent can't reply on any channel while the organization has no credits
 * (the gateway refuses every turn), so its overview says so up front. Shares
 * the top bar's balance query, so it costs no extra request.
 */
export function AgentCreditsNotice() {
    const pathname = usePathname() ?? "";
    const organization = useCopilot()?.agent.organization ?? null;
    const { data } = useQuery({
        queryKey: ["orgCreditsBalance", organization?.id ?? null],
        enabled: !!organization?.id,
        queryFn: async () => {
            const { data, error } = await supabase.from("organizations").select("credits_balance").eq("id", organization!.id).single();
            if (error) throw error;
            return data as { credits_balance: number | string | null };
        },
        staleTime: 5 * 60 * 1000,
    });
    if (!organization || !data) return null;
    const balance = Number(data.credits_balance ?? 0);
    // Matches the gateway: under a cent can't serve a reply.
    if (Number.isFinite(balance) && balance >= 0.01) return null;

    const billingHref = getConsoleRoute(pathname) ? "/billing" : `/${organization.slug}/~/billing`;
    return (
        <section className="mb-6 flex items-center gap-4 rounded-lg border border-red-500/30 bg-red-500/5 px-5 py-3">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Add credits so your agent can reply</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Your balance is empty. Until you top up, customers on your website and WhatsApp won&apos;t get replies.</p>
            </div>
            <Button asChild size="sm" className="h-7 shrink-0 text-xs"><Link href={billingHref}>Add credits</Link></Button>
        </section>
    );
}
