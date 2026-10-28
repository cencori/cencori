import "server-only";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { escapeHtml, sendEmail } from "@/lib/email/sendbyte";
import { pushToOwners } from "@/lib/studio/push";
import { earnedSince, paidThroughAssistant } from "@/lib/studio/earned";
import { BUSINESS_EXTRA_SHARE, BUSINESS_GRACE_DAYS, conversationCapacity, readPlan, type OrganizationPlan } from "@/lib/business/plans";

/**
 * Plan reminders, so a business never finds its assistant silent: by Studio
 * push notification and email to the owner, each once per billing period.
 *
 * - By date (the hourly owner-alerts job): 7 days left (paid plans), 3 days,
 *   1 day, the plan ended (grace days running), and the assistant stopped.
 * - By chats (when a conversation is counted): 80% used, and all used (the
 *   extras running).
 *
 * Sent reminders are kept on the period's business_usage row
 * (`reminders_sent`); a new pass is a new row, so its reminders start over.
 */

type Admin = ReturnType<typeof createAdminClient>;

export type PlanReminder = "ends_7" | "ends_3" | "ends_1" | "grace" | "stopped" | "chats_most" | "chats_all";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ORDER: PlanReminder[] = ["ends_7", "ends_3", "ends_1", "grace", "stopped"];
/** A plan stopped longer ago than this is past reminding. */
const STOPPED_REMIND_DAYS = 2;

/** The date reminder due now, if any: the latest one the plan has reached. */
export function dateReminderDue(plan: OrganizationPlan, now = Date.now()): PlanReminder | null {
    if (!plan.plan || !plan.periodEnd || plan.status === null) return null;
    const end = Date.parse(plan.periodEnd);
    const graceEnd = end + BUSINESS_GRACE_DAYS * DAY_MS;
    if (now >= graceEnd) return now < graceEnd + STOPPED_REMIND_DAYS * DAY_MS ? "stopped" : null;
    if (now >= end) return "grace";
    const left = end - now;
    if (left <= DAY_MS) return "ends_1";
    if (left <= 3 * DAY_MS) return "ends_3";
    // The trial is two weeks: a week's notice there is noise.
    if (left <= 7 * DAY_MS && plan.plan.id !== "trial") return "ends_7";
    return null;
}

function naira(amount: number, currency: string): string {
    return currency === "NGN" ? `₦${Math.round(amount).toLocaleString("en-NG")}` : `${currency} ${amount.toLocaleString("en-NG")}`;
}

function message(kind: PlanReminder, plan: OrganizationPlan, earned: string | null): { title: string; body: string } {
    const name = plan.plan!.id === "trial" ? "free trial" : `${plan.plan!.name} plan`;
    const keep = earned ? `${earned} came in through your assistant this month. ` : "";
    const extras = plan.plan ? conversationCapacity(plan.plan) - plan.plan.conversations : 0;
    switch (kind) {
        case "ends_7": return { title: `Your ${name} ends in 7 days`, body: `${keep}Renew to keep your assistant answering.` };
        case "ends_3": return { title: `Your ${name} ends in 3 days`, body: `${keep}Renew to keep your assistant answering.` };
        case "ends_1": return { title: `Your ${name} ends tomorrow`, body: `${keep}Renew to keep your assistant answering.` };
        case "grace": return { title: `Your ${name} has ended`, body: `Your assistant keeps answering for ${BUSINESS_GRACE_DAYS} more days. Renew to keep it on.` };
        case "stopped": return { title: "Your assistant has stopped answering", body: "Choose a plan to switch it back on." };
        case "chats_most": return { title: `80% of your chats used`, body: `${plan.plan!.conversations - Math.ceil(plan.plan!.conversations * 0.8)} left this month. Renew or upgrade before they run out.` };
        case "chats_all": return { title: "All your chats used", body: `Your assistant answers ${extras} more (${Math.round(BUSINESS_EXTRA_SHARE * 100)}% extra). Renew or upgrade to keep it going.` };
    }
}

/** Claim a reminder for the period; false when it was already sent. */
async function claim(db: Admin, organizationId: string, periodStart: string, kinds: PlanReminder[]): Promise<boolean> {
    await db.from("business_usage" as never).upsert({ organization_id: organizationId, period_start: periodStart, conversations: 0 } as never, { onConflict: "organization_id,period_start", ignoreDuplicates: true });
    const { data, error } = await db.from("business_usage" as never).select("reminders_sent").eq("organization_id", organizationId).eq("period_start", periodStart).maybeSingle();
    // No column yet (migration not applied): send nothing rather than every hour.
    if (error || !data) return false;
    const sent = ((data as { reminders_sent?: string[] }).reminders_sent ?? []) as string[];
    const target = kinds[kinds.length - 1];
    if (sent.includes(target)) return false;
    const next = Array.from(new Set([...sent, ...kinds]));
    const { data: updated } = await db.from("business_usage" as never).update({ reminders_sent: next } as never)
        .eq("organization_id", organizationId).eq("period_start", periodStart)
        .not("reminders_sent", "cs", `{${target}}`)
        .select("organization_id");
    return ((updated ?? []) as unknown[]).length > 0;
}

/**
 * Tell the owner: push to every one of the business's projects (Studio), and
 * an email to the organization's owner. Best-effort; never throws.
 */
export async function remindOwners(db: Admin, organizationId: string, plan: OrganizationPlan, kind: PlanReminder, kindsCovered: PlanReminder[] = [kind]): Promise<boolean> {
    if (!plan.plan || !plan.periodStart) return false;
    try {
        if (!(await claim(db, organizationId, plan.periodStart, kindsCovered))) return false;
        const [{ data: projects }, { data: organization }] = await Promise.all([
            db.from("projects").select("id").eq("organization_id", organizationId),
            db.from("organizations").select("name, owner_id").eq("id", organizationId).maybeSingle(),
        ]);
        const projectIds = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id);

        // What came in this month across the business, to set beside the renewal.
        let earned: string | null = null;
        if (kind.startsWith("ends_")) {
            const monthAgo = new Date(Date.now() - 30 * DAY_MS);
            const totals = await Promise.all(projectIds.map((id) => paidThroughAssistant(db, id).then(({ currency, paid }) => ({ currency, amount: earnedSince(paid, monthAgo).amount })).catch(() => null)));
            const ngn = totals.filter((t): t is { currency: string; amount: number } => !!t && t.currency === "NGN").reduce((sum, t) => sum + t.amount, 0);
            if (ngn > 0) earned = naira(ngn, "NGN");
        }

        const text = message(kind, plan, earned);
        await Promise.all(projectIds.map((id) => pushToOwners(db, id, { ...text, url: "/?plan=choose", tag: "plan" })));

        const ownerId = (organization as { owner_id?: string } | null)?.owner_id;
        const email = ownerId ? (await db.auth.admin.getUserById(ownerId)).data.user?.email : null;
        if (email) {
            const business = (organization as { name?: string } | null)?.name ?? "Your business";
            await sendEmail({
                to: [email],
                subject: `${business}: ${text.title.charAt(0).toLowerCase()}${text.title.slice(1)}`,
                html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#71717a">${escapeHtml(business)}</p>
<h1 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#18181b">${escapeHtml(text.title)}</h1>
<p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#3f3f46">${escapeHtml(text.body)}</p>
<a href="https://studio.cencori.com/?plan=choose" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:999px">Choose a plan</a>
</div></body></html>`,
            });
        }
        return true;
    } catch (error) {
        console.error("[business] plan reminder failed", error instanceof Error ? error.message : error);
        return false;
    }
}

/** The hourly job: every business plan's date reminder that's due and not yet sent. */
export async function sendPlanReminders(db: Admin, now = Date.now()): Promise<{ sent: number }> {
    // Plans ending within a week, or ended recently enough to still remind.
    const from = new Date(now - (BUSINESS_GRACE_DAYS + STOPPED_REMIND_DAYS) * DAY_MS).toISOString();
    const to = new Date(now + 7 * DAY_MS).toISOString();
    const { data } = await db.from("organizations")
        .select("id, account_type, business_plan, business_plan_status, business_period_start, business_period_end")
        .eq("account_type", "business").gte("business_period_end", from).lte("business_period_end", to).limit(5_000);
    let sent = 0;
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const plan = readPlan(row, now);
        const kind = dateReminderDue(plan, now);
        if (!kind) continue;
        // Reaching a later reminder covers the earlier ones it skipped.
        const covered = DATE_ORDER.slice(0, DATE_ORDER.indexOf(kind) + 1);
        if (await remindOwners(db, row.id as string, plan, kind, covered)) sent++;
    }
    return { sent };
}
