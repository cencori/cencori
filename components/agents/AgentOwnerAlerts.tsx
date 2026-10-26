"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { readJson } from "@/components/agents/widget-preview";
import { SettingsCard, SettingsFooter, SettingsRow, SettingsSection, settingsInputClass } from "@/components/agents/settings-layout";
import { cn } from "@/lib/utils";
import { SettingsCardSkeleton } from "@/components/agents/AgentSkeletons";
const TIME_ZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo", "Europe/London", "America/New_York", "UTC"];

type Entry = { type: "booking" | "callback" | "payment" | "order"; at: string; title: string; when?: string | null; contact?: string | null; source?: string | null };
type Alerts = { emails: string[]; bookings: boolean; callbacks: boolean; daily_summary: boolean; time_zone: string; recent: Entry[] };
type Payload = { alerts: Alerts; configured: boolean; can_manage: boolean };
type Form = Omit<Alerts, "recent">;

const formFrom = (alerts: Alerts | undefined): Form => ({
    emails: alerts?.emails ?? [],
    bookings: alerts?.bookings ?? true,
    callbacks: alerts?.callbacks ?? true,
    daily_summary: alerts?.daily_summary ?? true,
    time_zone: alerts?.time_zone ?? "Africa/Lagos",
});

/**
 * Owner alerts: the people who hear, by email, when the agent books
 * something or someone needs a call back, plus a morning summary.
 */
export function AgentOwnerAlerts() {
    const { projectId, agent } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const endpoint = `/api/projects/${projectId}/embedded-agents/${agent.id}/alerts`;
    const queryKey = ["agent-alerts", projectId, agent.id];
    const query = useQuery({ queryKey, queryFn: async () => readJson<Payload>(await fetch(endpoint, { cache: "no-store" })) });
    const payload = query.data;

    const [form, setForm] = useState<Form>(() => formFrom(undefined));
    const [emailInput, setEmailInput] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (payload) setForm(formFrom(payload.alerts));
    }, [payload]);

    const saved = formFrom(payload?.alerts);
    const pending = emailInput.trim();
    const dirty = JSON.stringify(form) !== JSON.stringify(saved) || !!pending;
    const disabled = !payload?.can_manage || !!busy;

    const addEmail = () => {
        if (!pending) return;
        if (!form.emails.includes(pending.toLowerCase())) setForm((current) => ({ ...current, emails: [...current.emails, pending.toLowerCase()] }));
        setEmailInput("");
    };

    const save = async () => {
        setBusy("save");
        setError(null);
        try {
            const emails = pending && !form.emails.includes(pending.toLowerCase()) ? [...form.emails, pending.toLowerCase()] : form.emails;
            const result = await readJson<Payload>(await fetch(endpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, emails }),
            }));
            queryClient.setQueryData<Payload>(queryKey, result);
            setEmailInput("");
            toast.success("Alerts saved");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save. Try again.");
        } finally {
            setBusy(null);
        }
    };

    const test = async () => {
        setBusy("test");
        setError(null);
        try {
            const result = await readJson<{ sent: number }>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) }));
            toast.success(result.sent === 1 ? "Test email sent" : `Test email sent to ${result.sent} addresses`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't send the test.");
        } finally {
            setBusy(null);
        }
    };

    const description = "Emails about bookings, people to call back, and a morning summary.";
    if (query.isLoading || query.isError || !payload) {
        return (
            <SettingsSection id="alerts" title="Owner alerts" description={description}>
                {query.isLoading
                    ? <SettingsCardSkeleton rows={4} />
                    : <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load alerts."}</p>}
            </SettingsSection>
        );
    }

    return (
        <SettingsSection id="alerts" title="Owner alerts" description={description}>
            {!payload.can_manage && <p className="text-xs text-muted-foreground">Only project admins can change alerts.</p>}
            <SettingsCard>
                <SettingsRow label="Send alerts to" description="Up to 5 email addresses." stacked>
                    {form.emails.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {form.emails.map((email) => (
                                <span key={email} className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[11px] ring-1 ring-border/40">
                                    {email}
                                    <button type="button" disabled={disabled} aria-label={`Remove ${email}`} onClick={() => setForm((current) => ({ ...current, emails: current.emails.filter((item) => item !== email) }))} className="text-muted-foreground hover:text-foreground">
                                        <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input value={emailInput} onChange={(event) => setEmailInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addEmail(); } }} placeholder="owner@yourbusiness.com" type="email" disabled={disabled} className={settingsInputClass} />
                        <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 text-xs md:h-8" onClick={addEmail} disabled={disabled || !pending}>Add</Button>
                    </div>
                </SettingsRow>
                <SettingsRow label="Bookings" description="An email for each booking, with the time, the details and who made it.">
                    <Switch checked={form.bookings} disabled={disabled} onCheckedChange={(bookings) => setForm((current) => ({ ...current, bookings }))} aria-label="Bookings" />
                </SettingsRow>
                <SettingsRow label="Callback requests" description="When someone needs a person, like a large party or a complaint. Needs Request a callback on, under Tools.">
                    <Switch checked={form.callbacks} disabled={disabled} onCheckedChange={(callbacks) => setForm((current) => ({ ...current, callbacks }))} aria-label="Callback requests" />
                </SettingsRow>
                <SettingsRow label="Morning summary" description="Around 8am, the day before's bookings and callbacks. Skipped on quiet days.">
                    <Switch checked={form.daily_summary} disabled={disabled} onCheckedChange={(daily_summary) => setForm((current) => ({ ...current, daily_summary }))} aria-label="Morning summary" />
                </SettingsRow>
                <SettingsRow label="Time zone" description="For the morning summary and the times in alerts.">
                    <select value={form.time_zone} onChange={(event) => setForm((current) => ({ ...current, time_zone: event.target.value }))} disabled={disabled} className={cn(settingsInputClass, "md:w-48")} aria-label="Time zone">
                        {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone.replace("_", " ")}</option>)}
                    </select>
                </SettingsRow>
                <SettingsFooter>
                    {error && <p role="alert" className="mr-auto text-xs text-destructive">{error}</p>}
                    {payload.configured && saved.emails.length > 0 && !dirty && (
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled} onClick={() => void test()}>
                            {busy === "test" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            Send a test
                        </Button>
                    )}
                    <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" disabled={disabled || !dirty} onClick={() => void save()}>
                        {busy === "save" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                        Save
                    </Button>
                </SettingsFooter>
            </SettingsCard>

            {payload.alerts.recent.length > 0 && (
                <SettingsCard>
                    <SettingsRow label="Latest alerts" />
                    {payload.alerts.recent.map((entry) => (
                        <div key={`${entry.at}-${entry.title}`} className="flex items-start justify-between gap-4 border-b border-border/30 px-4 py-2.5 text-xs last:border-b-0">
                            <span>
                                <span className="font-medium">{{ booking: "Booking", callback: "Call back", payment: "Payment", order: "Order" }[entry.type] ?? entry.type}:</span> {entry.title}
                                {entry.when ? `, ${entry.when}` : ""}{entry.contact ? `, ${entry.contact}` : ""}
                                {entry.source && <span className="block text-[11px] text-muted-foreground">via {entry.source}</span>}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(entry.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                    ))}
                </SettingsCard>
            )}
        </SettingsSection>
    );
}
