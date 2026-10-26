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
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-md bg-[#f3f3f1] px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:bg-[#ececea] dark:bg-[#181818] dark:focus:bg-[#1f1f1f] disabled:opacity-60";
const TIME_ZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo", "Europe/London", "America/New_York", "UTC"];

type Entry = { type: "booking" | "callback"; at: string; title: string; when?: string | null; contact?: string | null; source?: string | null };
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

function Toggle({ label, detail, checked, disabled, onChange }: { label: string; detail: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-start justify-between gap-4 py-3">
            <span>
                <span className="block text-sm">{label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
            </span>
            <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
        </label>
    );
}

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

    if (query.isLoading) {
        return <div className="flex h-24 items-center justify-center text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" /></div>;
    }
    if (query.isError || !payload) {
        return <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load alerts."}</p>;
    }

    return (
        <div className="space-y-5">
            <header>
                <h2 className="text-sm font-medium">Owner alerts</h2>
                <p className="mt-0.5 max-w-lg text-xs text-muted-foreground">
                    Hear about what needs you: each booking {agent.name} makes, people to call back, and a morning summary of the day before.
                </p>
            </header>
            {!payload.can_manage && <p className="text-xs text-muted-foreground">Only project admins can change alerts.</p>}

            <section className="rounded-lg border border-border/60">
                <div className="space-y-2 border-b border-border/60 p-4">
                    <span className="block text-xs font-medium">Send alerts to</span>
                    {form.emails.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {form.emails.map((email) => (
                                <span key={email} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px]">
                                    {email}
                                    <button type="button" disabled={disabled} aria-label={`Remove ${email}`} onClick={() => setForm((current) => ({ ...current, emails: current.emails.filter((item) => item !== email) }))} className="text-muted-foreground hover:text-foreground">
                                        <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            value={emailInput}
                            onChange={(event) => setEmailInput(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addEmail(); } }}
                            placeholder="owner@yourbusiness.com"
                            type="email"
                            disabled={disabled}
                            className={inputClass}
                        />
                        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 text-xs" onClick={addEmail} disabled={disabled || !pending}>Add</Button>
                    </div>
                </div>
                <div className="divide-y divide-border/60 px-4">
                    <Toggle label="Bookings" detail="An email for each booking, with the time, the details and who made it." checked={form.bookings} disabled={disabled} onChange={(bookings) => setForm((current) => ({ ...current, bookings }))} />
                    <Toggle label="Callback requests" detail="When someone needs a person, like a large party or a complaint. Needs Request a callback on, under Tools." checked={form.callbacks} disabled={disabled} onChange={(callbacks) => setForm((current) => ({ ...current, callbacks }))} />
                    <div className="py-3">
                        <Toggle label="Morning summary" detail="Around 8am, the day before's bookings and callbacks. Skipped on quiet days." checked={form.daily_summary} disabled={disabled} onChange={(daily_summary) => setForm((current) => ({ ...current, daily_summary }))} />
                        <select value={form.time_zone} onChange={(event) => setForm((current) => ({ ...current, time_zone: event.target.value }))} disabled={disabled || !form.daily_summary} className={cn(inputClass, "max-w-[220px]")} aria-label="Time zone">
                            {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone.replace("_", " ")}</option>)}
                        </select>
                    </div>
                </div>
            </section>

            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-3">
                {payload.configured && saved.emails.length > 0 && !dirty && (
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled} onClick={() => void test()}>
                        {busy === "test" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                        Send a test
                    </Button>
                )}
                <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled || !dirty} onClick={() => void save()}>
                    {busy === "save" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                    Save
                </Button>
            </div>

            {payload.alerts.recent.length > 0 && (
                <section>
                    <h3 className="mb-2 text-xs font-medium text-muted-foreground">Latest</h3>
                    <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-xs">
                        {payload.alerts.recent.map((entry) => (
                            <li key={`${entry.at}-${entry.title}`} className="flex items-start justify-between gap-4 px-4 py-2.5">
                                <span>
                                    <span className="font-medium">{entry.type === "booking" ? "Booking" : "Call back"}:</span> {entry.title}
                                    {entry.when ? `, ${entry.when}` : ""}{entry.contact ? `, ${entry.contact}` : ""}
                                    {entry.source && <span className="block text-muted-foreground">via {entry.source}</span>}
                                </span>
                                <span className="shrink-0 text-muted-foreground">{new Date(entry.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
