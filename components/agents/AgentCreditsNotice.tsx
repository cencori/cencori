"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useCopilot } from "@/lib/contexts/CopilotContext";
import { getConsoleRoute } from "@/lib/console/routing";
import { useBusinessPlan } from "@/components/dashboard/billing/BusinessPlan";
import { Button } from "@/components/ui/button";

/**
 * An agent can't start conversations while its organization can't pay for
 * them: a business with no active plan or no conversations left, or a
 * developer organization with no credits. Its overview says so up front.
 * Shares the top bar's queries, so it costs no extra request.
 */
export function AgentCreditsNotice() {
    const pathname = usePathname() ?? "";
    const organization = useCopilot()?.agent.organization ?? null;
    const business = useBusinessPlan(organization?.id);
    const isBusiness = business.data?.account_type === "business";
    const credits = useQuery({
        queryKey: ["orgCreditsBalance", organization?.id ?? null],
        enabled: !!organization?.id && business.isSuccess && !isBusiness,
        queryFn: async () => {
            const { data, error } = await supabase.from("organizations").select("credits_balance").eq("id", organization!.id).single();
            if (error) throw error;
            return data as { credits_balance: number | string | null };
        },
        staleTime: 5 * 60 * 1000,
    });
    if (!organization || !business.data) return null;

    let title: string;
    let detail: string;
    let action: string;
    if (isBusiness) {
        const plan = business.data.plan;
        const usedUp = !!plan && business.data.conversations_used >= plan.conversations;
        if (business.data.active && !usedUp) return null;
        title = business.data.active ? "Your conversations for this month are used up" : "Your plan has ended";
        detail = "Your agents won't start new chats on your website or WhatsApp until you renew or upgrade.";
        action = business.data.active ? "Upgrade" : "Choose a plan";
    } else {
        if (!credits.data) return null;
        const balance = Number(credits.data.credits_balance ?? 0);
        // Matches the gateway: under a cent can't serve a reply.
        if (Number.isFinite(balance) && balance >= 0.01) return null;
        title = "Add credits so your agent can reply";
        detail = "Your balance is empty. Until you top up, customers on your website and WhatsApp won't get replies.";
        action = "Add credits";
    }

    const billingHref = getConsoleRoute(pathname) ? "/billing" : `/${organization.slug}/~/billing`;
    return (
        <section className="mb-6 flex items-center gap-4 rounded-lg border border-red-500/30 bg-red-500/5 px-5 py-3">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
            </div>
            <Button asChild size="sm" className="h-7 shrink-0 text-xs"><Link href={billingHref}>{action}</Link></Button>
        </section>
    );
}
