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
import { useWhatsAppSignup, type SignupConfig } from "@/components/agents/whatsapp-signup";
import { SettingsCard, SettingsFooter, SettingsRow, SettingsSection, settingsInputClass } from "@/components/agents/settings-layout";
import { SettingsCardSkeleton } from "@/components/agents/AgentSkeletons";

interface Channel {
    id: string;
    phone_number_id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    enabled: boolean;
    /** Connected through Cencori's Meta app (Connect WhatsApp): no webhook to set up. */
    managed: boolean;
    coexistence: boolean;
    webhook_url: string | null;
    verify_token: string | null;
    webhook_verified: boolean;
    last_message_at: string | null;
    daily_session_cap: number;
}

type Payload = { channel: Channel | null; can_manage: boolean; signup: SignupConfig | null };
type Form = { phoneNumberId: string; accessToken: string; appSecret: string; cap: string };

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
        <SettingsRow label={label} stacked>
            <div className="relative">
                <div className="overflow-x-auto whitespace-nowrap rounded-md border border-border/40 bg-background px-3 py-2 pr-10 font-mono text-[11px] leading-5">{value}</div>
                <button type="button" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <HugeiconsIcon icon={Copy01Icon} className="h-3.5 w-3.5" />
                </button>
            </div>
        </SettingsRow>
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
    // Embedded Signup ("Connect WhatsApp") when Cencori's Meta app is set up; the
    // business's own Meta app (the form) otherwise, or when they choose it.
    const signup = useWhatsAppSignup(query.data?.signup ?? null);
    const [ownApp, setOwnApp] = useState(false);
    const [coexistence, setCoexistence] = useState(true);

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

    const connectWithMeta = async () => {
        setError(null);
        let result;
        try {
            // Opens Meta's popup straight from the click.
            result = await signup.start({ coexistence });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Connecting WhatsApp didn't finish.");
            return;
        }
        setBusy("signup");
        try {
            const saved = await readJson<Payload>(await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: result.code, phone_number_id: result.phoneNumberId, waba_id: result.wabaId, coexistence: result.coexistence }),
            }));
            queryClient.setQueryData<Payload>(queryKey, saved);
            setEditing(false);
            toast.success(`Connected ${saved.channel?.display_phone_number ?? "WhatsApp"}`, { description: `${agent.name} now answers messages to this number.` });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
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

    const description = "Customers message your WhatsApp number and the published version replies.";
    if (query.isLoading || query.isError) {
        return (
            <SettingsSection id="whatsapp" title="WhatsApp" description={description}>
                {query.isLoading
                    ? <SettingsCardSkeleton rows={3} />
                    : <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load WhatsApp."}</p>}
            </SettingsSection>
        );
    }

    const disabled = !canManage || !!busy;
    const signupAvailable = !!query.data?.signup;
    // The form is for a business's own Meta app: shown when signup isn't available, chosen, or editing such a number.
    const showForm = (!channel && (!signupAvailable || ownApp)) || (editing && !channel?.managed);
    const showSignup = signupAvailable && !ownApp && (!channel || (editing && !!channel.managed));
    const canSubmit = form.phoneNumberId.trim() && (channel || (form.accessToken.trim() && form.appSecret.trim()));

    return (
        <SettingsSection
            id="whatsapp"
            title="WhatsApp"
            description={description}
        >
            {!published && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">Publish this agent first. WhatsApp always runs the published version.</p>
            )}
            {!canManage && <p className="text-xs text-muted-foreground">Only project admins can connect WhatsApp.</p>}

            {channel && !editing && (
                <SettingsCard>
                    <SettingsRow
                        label={channel.display_phone_number ?? channel.phone_number_id}
                        description={<>{channel.verified_name ? `${channel.verified_name} · ` : ""}{channel.last_message_at ? `Last message ${new Date(channel.last_message_at).toLocaleString()}` : "No messages yet"}</>}
                    >
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={disabled} onClick={() => { setEditing(true); setError(null); }}>{channel.managed ? "Change number" : "Edit"}</Button>
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive" disabled={disabled} onClick={async () => { if (await request("DELETE", null, "delete")) toast.success("WhatsApp disconnected"); }}>
                                {busy === "delete" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                Disconnect
                            </Button>
                        </div>
                    </SettingsRow>
                    <SettingsRow label="Replies" description={channel.enabled ? `On: ${agent.name} answers messages to this number.` : "Off: messages to this number go unanswered by the agent."}>
                        <Switch
                            checked={channel.enabled}
                            disabled={disabled || !published}
                            aria-label="WhatsApp replies"
                            onCheckedChange={async (checked) => {
                                if (await request("PUT", { enabled: checked }, "toggle")) toast.success(checked ? "WhatsApp replies are on" : "WhatsApp replies are off");
                            }}
                        />
                    </SettingsRow>
                    {channel.managed && (
                        <SettingsRow label="Connection" description={channel.coexistence ? "Through Meta, alongside the WhatsApp Business app on your phone." : "Through Meta, on the WhatsApp Cloud API."} />
                    )}
                </SettingsCard>
            )}

            {showSignup && (
                <SettingsCard>
                    <SettingsRow label={channel ? "Connect another number" : "Connect your number"} description="Log in with Facebook, pick your business and confirm your number with the code WhatsApp sends. About two minutes." />
                    <SettingsRow
                        label="I use the WhatsApp Business app on this number"
                        description={<>Keep using the app on your phone; {agent.name} answers alongside you and you see every chat. Off for a new number that isn&apos;t on WhatsApp yet.</>}
                    >
                        <Switch checked={coexistence} onCheckedChange={setCoexistence} disabled={disabled} aria-label="I use the WhatsApp Business app on this number" />
                    </SettingsRow>
                    <SettingsFooter className="justify-between">
                        <button type="button" className="text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => { setOwnApp(true); setError(null); }}>
                            Use my own Meta app instead
                        </button>
                        <div className="flex items-center gap-2">
                            {channel && <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!!busy} onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>}
                            <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" disabled={disabled || !published || !signup.ready} onClick={() => void connectWithMeta()}>
                                {busy === "signup" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                Connect WhatsApp
                            </Button>
                        </div>
                    </SettingsFooter>
                </SettingsCard>
            )}
            {showSignup && (error || signup.error) && <p role="alert" className="text-xs text-destructive">{error ?? signup.error}</p>}

            {showForm && (
                <SettingsCard>
                    <SettingsRow label={channel ? "Credentials" : "Connect with your own Meta app"} description="From your Meta app with the WhatsApp product added (developers.facebook.com → your app → WhatsApp → API Setup)." />
                    <SettingsRow label="Phone number ID" description="The long ID under the phone number in API Setup, not the number itself.">
                        <input value={form.phoneNumberId} onChange={(event) => setForm((current) => ({ ...current, phoneNumberId: event.target.value.replace(/[^0-9]/g, "") }))} inputMode="numeric" placeholder="106540352242922" disabled={disabled} className={cn(settingsInputClass, "font-mono md:w-64")} />
                    </SettingsRow>
                    <SettingsRow label="Access token" description={channel ? "Leave blank to keep the saved token." : "A permanent system-user token, not the 24-hour test token."}>
                        <input type="password" autoComplete="off" value={form.accessToken} onChange={(event) => setForm((current) => ({ ...current, accessToken: event.target.value }))} placeholder={channel ? "••••••••" : "EAAG…"} disabled={disabled} className={cn(settingsInputClass, "font-mono md:w-64")} />
                    </SettingsRow>
                    <SettingsRow label="App secret" description={channel ? "Leave blank to keep the saved secret." : "App settings → Basic. Checks messages really come from Meta."}>
                        <input type="password" autoComplete="off" value={form.appSecret} onChange={(event) => setForm((current) => ({ ...current, appSecret: event.target.value }))} placeholder={channel ? "••••••••" : ""} disabled={disabled} className={cn(settingsInputClass, "font-mono md:w-64")} />
                    </SettingsRow>
                    <SettingsRow label="Conversations per day" description="New conversations stop for the day at this number. A conversation restarts after 40 messages or a day of quiet.">
                        <input value={form.cap} onChange={(event) => setForm((current) => ({ ...current, cap: event.target.value.replace(/[^0-9]/g, "") }))} inputMode="numeric" disabled={disabled} className={cn(settingsInputClass, "md:w-28")} />
                    </SettingsRow>
                    <SettingsFooter>
                        {error && <p role="alert" className="mr-auto text-xs text-destructive">{error}</p>}
                        {!channel && signupAvailable && <Button variant="outline" size="sm" className="mr-auto h-7 text-xs" disabled={!!busy} onClick={() => { setOwnApp(false); setError(null); }}>Back</Button>}
                        {channel && <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!!busy} onClick={() => { setEditing(false); setForm(formFrom(channel)); setError(null); }}>Cancel</Button>}
                        <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" disabled={disabled || !published || !canSubmit} onClick={() => void connect()}>
                            {busy === "save" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            {channel ? "Save" : "Connect"}
                        </Button>
                    </SettingsFooter>
                </SettingsCard>
            )}
            {!showForm && !showSignup && error && <p role="alert" className="text-xs text-destructive">{error}</p>}

            {channel && !channel.managed && channel.webhook_url && channel.verify_token && (
                <SettingsCard>
                    <SettingsRow label="Webhook" description="In your Meta app: WhatsApp → Configuration → Webhook → Edit. Paste these, verify, then subscribe to the messages field." />
                    <CopyRow label="Callback URL" value={channel.webhook_url} />
                    <CopyRow label="Verify token" value={channel.verify_token} />
                    <div className={cn("flex items-center gap-2 px-4 py-3 text-xs", channel.webhook_verified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", channel.webhook_verified ? "bg-emerald-500" : "animate-pulse bg-muted-foreground/50")} />
                        {channel.webhook_verified ? "Meta verified the webhook. Messages to this number now reach the agent." : "Waiting for Meta to verify the webhook…"}
                    </div>
                </SettingsCard>
            )}
        </SettingsSection>
    );
}
