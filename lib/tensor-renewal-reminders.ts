import "server-only";

import { adminUsers } from "@/lib/auth/admin-users";
import { escapeHtml, sendEmail } from "@/lib/email/sendbyte";
import type { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * Renewal reminders for a Tensor month that will not renew by itself.
 *
 * A plan paid for by card renews, and needs no reminding. One paid for in naira is a single
 * month: it ends unless it is paid for again, so its owner is emailed three days before, the day
 * before, and once when it has ended. Each goes once for a given end date, claimed in the
 * database before it is sent, so the hourly job can run as often or as late as it likes.
 */

type Admin = ReturnType<typeof createAdminClient>;

export type RenewalReminder = "ends_3" | "ends_1" | "ended";

const DAY_MS = 24 * 60 * 60 * 1000;
const ORDER: RenewalReminder[] = ["ends_3", "ends_1", "ended"];
/** A month that ended longer ago than this is past reminding. */
const ENDED_REMIND_DAYS = 2;
const PLANS_URL = "https://cencori.com/tensor#plans";

/** The reminder a month ending at `endsAt` has reached, if any. */
export function renewalReminderDue(endsAt: string | null, now = Date.now()): RenewalReminder | null {
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;
  if (Number.isNaN(end)) return null;
  if (now >= end) return now < end + ENDED_REMIND_DAYS * DAY_MS ? "ended" : null;
  const left = end - now;
  if (left <= DAY_MS) return "ends_1";
  if (left <= 3 * DAY_MS) return "ends_3";
  return null;
}

export function renewalReminderText(
  kind: RenewalReminder,
  planName: string,
): { title: string; body: string } {
  switch (kind) {
    case "ends_3":
      return {
        title: `Your Tensor ${planName} plan ends in 3 days`,
        body: "Pay for another month now and it is added to the end of this one, so you lose none of the days you have left.",
      };
    case "ends_1":
      return {
        title: `Your Tensor ${planName} plan ends tomorrow`,
        body: "Pay for another month now and it is added to the end of this one, so nothing is interrupted.",
      };
    case "ended":
      return {
        title: `Your Tensor ${planName} plan has ended`,
        body: "You are back on the trial's five tasks a month. Choose a plan to pick up where you left off.",
      };
  }
}

/** The hourly job: every month's reminder that is due and has not been sent. */
export async function sendTensorRenewalReminders(
  db: Admin,
  now = Date.now(),
): Promise<{ sent: number }> {
  const from = new Date(now - ENDED_REMIND_DAYS * DAY_MS).toISOString();
  const to = new Date(now + 3 * DAY_MS).toISOString();
  const { data: accounts, error } = await db
    .from("basecode_billing_accounts")
    .select("id, user_id, plan_code, entitlement_ends_at")
    .neq("plan_code", "free")
    .eq("status", "active")
    .gte("entitlement_ends_at", from)
    .lte("entitlement_ends_at", to)
    .limit(5_000);
  // No table or column yet (migration not applied): send nothing rather than fail the whole job.
  if (error || !accounts?.length) return { sent: 0 };

  const ids = accounts.map((account) => account.id as string);
  const [{ data: subscriptions }, { data: plans }] = await Promise.all([
    db.from("basecode_subscriptions").select("account_id, status").in("account_id", ids),
    db.from("basecode_plans").select("code, name"),
  ]);
  // A subscription still being collected on renews, or is retried, by Bachs.
  const renewing = new Set(
    ((subscriptions ?? []) as Array<{ account_id: string; status: string }>)
      .filter((row) => ["active", "trialing", "past_due"].includes(row.status))
      .map((row) => row.account_id),
  );
  const names = new Map(
    ((plans ?? []) as Array<{ code: string; name: string }>).map((plan) => [plan.code, plan.name]),
  );

  let sent = 0;
  for (const account of accounts as Array<{
    id: string;
    user_id: string;
    plan_code: string;
    entitlement_ends_at: string | null;
  }>) {
    if (renewing.has(account.id)) continue;
    const kind = renewalReminderDue(account.entitlement_ends_at, now);
    if (!kind) continue;
    try {
      // Reaching a later reminder covers the earlier ones it skipped.
      const { data: claimed, error: claimError } = await db.rpc("basecode_claim_renewal_reminder", {
        p_account_id: account.id,
        p_kinds: ORDER.slice(0, ORDER.indexOf(kind) + 1),
      });
      if (claimError || claimed !== true) continue;

      const email = (await adminUsers.getUserById(account.user_id)).data.user?.email;
      if (!email) continue;
      const text = renewalReminderText(kind, names.get(account.plan_code) ?? "paid");
      const delivered = await sendEmail({
        to: [email],
        subject: text.title,
        html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#71717a">Tensor</p>
<h1 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#18181b">${escapeHtml(text.title)}</h1>
<p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#3f3f46">${escapeHtml(text.body)}</p>
<a href="${PLANS_URL}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:999px">${kind === "ended" ? "Choose a plan" : "Renew now"}</a>
</div></body></html>`,
      });
      if (delivered) sent++;
    } catch (cause) {
      console.error("[Tensor Billing] Renewal reminder failed", cause instanceof Error ? cause.message : cause);
    }
  }
  return { sent };
}
