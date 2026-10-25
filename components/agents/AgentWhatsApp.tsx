"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { readJson } from "@/components/agents/widget-preview";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-md bg-[#f3f3f1] px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:bg-[#ececea] dark:bg-[#181818] dark:focus:bg-[#1f1f1f] disabled:opacity-60";

interface Channel {
    id: string;
    phone_number_id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    enabled: boolean;
    webhook_url: string;
    verify_token: string;
    webhook_verified: boolean;
    last_message_at: string | null;
    daily_session_cap: number;
}

type Payload = { channel: Channel | null; can_manage: boolean };
type Form = { phoneNumberId: string; accessToken: string; appSecret: string; cap: string };

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-medium">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
        </label>
    );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-border/60">
            <div className="border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-medium">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="space-y-4 p-4">{children}</div>
        </section>
    );
}

function CopyRow({ label, value }: { label: string; value: string }) {
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
        } catch {
            toast.error("Couldn't copy. Select it and copy it instead.");
        }
    };
    return (
        <Field label={label}>
            <div className="relative">
                <div className="overflow-x-auto whitespace-nowrap rounded-md bg-[#f3f3f1] px-3 py-2 pr-10 font-mono text-[11px] leading-5 dark:bg-[#181818]">{value}</div>
                <button type="button" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
                    <HugeiconsIcon icon={Copy01Icon} className="h-3.5 w-3.5" />
                </button>
            </div>
        </Field>
    );
}

const formFrom = (channel: Channel | null): Form => ({ phoneNumberId: channel?.phone_number_id ?? "", accessToken: "", appSecret: "", cap: String(channel?.daily_session_cap ?? 500) });

/**
 * The agent on WhatsApp: customers message the business's number and the
 * published agent replies. Uses the business's own WhatsApp Cloud API app.
 */
export function AgentWhatsApp() {
    const { projectId, agent } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const endpoint = `/api/projects/${projectId}/embedded-agents/${agent.id}/whatsapp`;
    const queryKey = ["agent-whatsapp", projectId, agent.id];
    const query = useQuery({ queryKey, queryFn: async () => readJson<Payload>(await fetch(endpoint, { cache: "no-store" })) });
    const channel = query.data?.channel ?? null;
    const canManage = !!query.data?.can_manage;
    const published = !!agent.stable_version_id;

    const [form, setForm] = useState<Form>(() => formFrom(null));
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        setForm(formFrom(channel));
    }, [channel?.id, channel?.phone_number_id, channel?.daily_session_cap]); // eslint-disable-line react-hooks/exhaustive-deps

    // Meta checks the webhook from its side; refresh until it has.
    useEffect(() => {
        if (!channel || channel.webhook_verified) return;
        const timer = setInterval(() => void queryClient.invalidateQueries({ queryKey }), 5000);
        return () => clearInterval(timer);
    }, [channel?.id, channel?.webhook_verified]); // eslint-disable-line react-hooks/exhaustive-deps

    const request = async (method: "PUT" | "DELETE", body: Record<string, unknown> | null, label: string) => {
        setBusy(label);
        setError(null);
        try {
            const result = await readJson<Payload>(await fetch(endpoint, {
                method,
                headers: body ? { "Content-Type": "application/json" } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            }));
            queryClient.setQueryData<Payload>(queryKey, result);
            return result;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            return null;
        } finally {
            setBusy(null);
        }
    };

    const connect = async () => {
        const result = await request("PUT", {
            phone_number_id: form.phoneNumberId.trim(),
            ...(form.accessToken.trim() ? { access_token: form.accessToken.trim() } : {}),
            ...(form.appSecret.trim() ? { app_secret: form.appSecret.trim() } : {}),
            daily_session_cap: Number(form.cap) || 500,
        }, "save");
        if (result?.channel) {
            setEditing(false);
            toast.success(channel ? "WhatsApp updated" : `Connected ${result.channel.display_phone_number ?? "WhatsApp"}`);
        }
    };

    if (query.isLoading) {
        return <div className="flex h-24 items-center justify-center text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" /></div>;
    }
    if (query.isError) {
        return <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load WhatsApp."}</p>;
    }

    const disabled = !canManage || !!busy;
    const showForm = !channel || editing;
    const canSubmit = form.phoneNumberId.trim() && (channel || (form.accessToken.trim() && form.appSecret.trim()));

    return (
        <div className="space-y-5">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-medium">WhatsApp</h2>
                    <p className="mt-0.5 max-w-lg text-xs text-muted-foreground">
                        Customers message your WhatsApp number and {agent.name} replies, using the published version and its tools. Each customer gets their own conversation.
                    </p>
                </div>
                {channel && (
                    <label className="flex shrink-0 items-center gap-2 text-xs">
                        <span className={channel.enabled ? "text-foreground" : "text-muted-foreground"}>{channel.enabled ? "On" : "Off"}</span>
                        <Switch
                            checked={channel.enabled}
                            disabled={disabled || !published}
                            onCheckedChange={async (checked) => {
                                if (await request("PUT", { enabled: checked }, "toggle")) toast.success(checked ? "WhatsApp replies are on" : "WhatsApp replies are off");
                            }}
                        />
                    </label>
                )}
            </header>

            {!published && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    Publish this agent first. WhatsApp always runs the published version.
                </p>
            )}
            {!canManage && <p className="text-xs text-muted-foreground">Only project admins can connect WhatsApp.</p>}

            {channel && !editing && (
                <Section title="Number">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-medium">{channel.display_phone_number ?? channel.phone_number_id}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {channel.verified_name ? `${channel.verified_name} · ` : ""}
                                {channel.last_message_at ? `Last message ${new Date(channel.last_message_at).toLocaleString()}` : "No messages yet"}
                            </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => { setEditing(true); setError(null); }}>Edit</Button>
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive" disabled={disabled} onClick={async () => { if (await request("DELETE", null, "delete")) toast.success("WhatsApp disconnected"); }}>
                                {busy === "delete" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                Disconnect
                            </Button>
                        </div>
                    </div>
                </Section>
            )}

            {showForm && (
                <Section title={channel ? "Credentials" : "Connect a number"} description="From your Meta app with the WhatsApp product added (developers.facebook.com → your app → WhatsApp → API Setup).">
                    <Field label="Phone number ID" hint="The long ID under the phone number in API Setup, not the number itself.">
                        <input value={form.phoneNumberId} onChange={(event) => setForm((current) => ({ ...current, phoneNumberId: event.target.value.replace(/[^0-9]/g, "") }))} inputMode="numeric" placeholder="106540352242922" disabled={disabled} className={cn(inputClass, "font-mono")} />
                    </Field>
                    <Field label="Access token" hint={channel ? "Leave blank to keep the saved token." : "Use a permanent token from a system user (Business settings → System users), not the 24-hour test token."}>
                        <input type="password" autoComplete="off" value={form.accessToken} onChange={(event) => setForm((current) => ({ ...current, accessToken: event.target.value }))} placeholder={channel ? "••••••••" : "EAAG…"} disabled={disabled} className={cn(inputClass, "font-mono")} />
                    </Field>
                    <Field label="App secret" hint={channel ? "Leave blank to keep the saved secret." : "App settings → Basic. Used to check messages really come from Meta."}>
                        <input type="password" autoComplete="off" value={form.appSecret} onChange={(event) => setForm((current) => ({ ...current, appSecret: event.target.value }))} placeholder={channel ? "••••••••" : ""} disabled={disabled} className={cn(inputClass, "font-mono")} />
                    </Field>
                    <Field label="Conversations per day" hint="New conversations stop for the day once this is reached. A conversation restarts after 40 messages or a day of quiet.">
                        <input value={form.cap} onChange={(event) => setForm((current) => ({ ...current, cap: event.target.value.replace(/[^0-9]/g, "") }))} inputMode="numeric" disabled={disabled} className={cn(inputClass, "max-w-[160px]")} />
                    </Field>
                    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                    <div className="flex justify-end gap-3">
                        {channel && <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!!busy} onClick={() => { setEditing(false); setForm(formFrom(channel)); setError(null); }}>Cancel</Button>}
                        <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled || !published || !canSubmit} onClick={() => void connect()}>
                            {busy === "save" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            {channel ? "Save" : "Connect"}
                        </Button>
                    </div>
                </Section>
            )}
            {!showForm && error && <p role="alert" className="text-xs text-destructive">{error}</p>}

            {channel && (
                <Section title="Webhook" description="In your Meta app: WhatsApp → Configuration → Webhook → Edit. Paste these, verify, then subscribe to the messages field.">
                    <CopyRow label="Callback URL" value={channel.webhook_url} />
                    <CopyRow label="Verify token" value={channel.verify_token} />
                    <p className={cn("flex items-center gap-2 text-xs", channel.webhook_verified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", channel.webhook_verified ? "bg-emerald-500" : "bg-muted-foreground/50 animate-pulse")} />
                        {channel.webhook_verified ? "Meta verified the webhook. Messages to this number now reach the agent." : "Waiting for Meta to verify the webhook…"}
                    </p>
                </Section>
            )}
        </div>
    );
}
