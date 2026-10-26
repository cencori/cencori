"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import {
    readJson,
    useAgentWidget,
    useWidgetPreview,
    widgetEndpoint,
    widgetQueryKey,
    widgetSiteOrigin,
    type Widget,
    type WidgetAppearance,
    type WidgetPayload,
} from "@/components/agents/widget-preview";
import { Segmented, SettingsCard, SettingsFooter, SettingsRow, SettingsSection, settingsInputClass } from "@/components/agents/settings-layout";
import { cn } from "@/lib/utils";

const FALLBACK_LOOK: WidgetAppearance = { title: "Assistant", greeting: "Hi! How can I help?", launcher_text: "Need help?", accent: "#111111", theme: "auto", position: "right", launcher_style: "card" };

type Form = { origins: string[]; appearance: WidgetAppearance; cap: string };

function formFrom(widget: Widget | null, defaults: WidgetAppearance | undefined): Form {
    return {
        origins: widget?.allowed_origins ?? [],
        appearance: { ...FALLBACK_LOOK, ...(defaults ?? {}), ...(widget?.appearance ?? {}) },
        cap: String(widget?.daily_session_cap ?? 500),
    };
}

/**
 * The agent on a website: one script tag, limited to the sites listed here.
 * The preview lives in the test panel (Widget mode), which shows unsaved look
 * changes as they're made.
 */
export function AgentWidget() {
    const { projectId, agent } = useAgentWorkspace();
    const preview = useWidgetPreview();
    const queryClient = useQueryClient();
    const queryKey = widgetQueryKey(projectId, agent.id);
    const endpoint = widgetEndpoint(projectId, agent.id);
    const query = useAgentWidget();
    const payload = query.data;
    const widget = payload?.widget ?? null;

    const [form, setForm] = useState<Form>(() => formFrom(null, undefined));
    const [originInput, setOriginInput] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snippetMode, setSnippetMode] = useState<"widget" | "inline">("widget");

    // Load the saved settings into the form whenever they change on the server.
    useEffect(() => {
        if (payload) setForm(formFrom(payload.widget, payload.defaults));
    }, [payload?.widget?.updated_at, payload?.ready]); // eslint-disable-line react-hooks/exhaustive-deps

    // This page drives the test panel: show the widget, live, while it's open.
    const { setMode, setDraftAppearance, openPanel } = preview;
    useEffect(() => {
        setMode("widget");
        openPanel();
        return () => setDraftAppearance(null);
    }, [setMode, openPanel, setDraftAppearance]);
    useEffect(() => {
        if (payload?.ready) setDraftAppearance(form.appearance);
    }, [form.appearance, payload?.ready, setDraftAppearance]);

    const saved = useMemo(() => formFrom(widget, payload?.defaults), [widget, payload?.defaults]);
    const dirty = JSON.stringify(form) !== JSON.stringify(saved);
    const canManage = !!payload?.can_manage;
    // From the workspace, not the widget payload: publishing elsewhere on the page updates it.
    const published = !!agent.stable_version_id;

    const siteOrigin = widgetSiteOrigin();
    const snippet = widget
        ? snippetMode === "widget"
            ? `<script src="${siteOrigin}/widget.js" data-key="${widget.public_key}" async></script>`
            : `<div id="cencori-chat"></div>\n<script src="${siteOrigin}/widget.js" data-key="${widget.public_key}" data-mode="inline" data-target="#cencori-chat" async></script>`
        : "";

    const update = (patch: Partial<WidgetAppearance>) => setForm((current) => ({ ...current, appearance: { ...current.appearance, ...patch } }));

    const addOrigin = () => {
        const value = originInput.trim();
        if (!value) return;
        if (!form.origins.includes(value)) setForm((current) => ({ ...current, origins: [...current.origins, value] }));
        setOriginInput("");
    };

    const save = async (extra: Record<string, unknown> = {}, label = "save") => {
        setBusy(label);
        setError(null);
        try {
            const pendingOrigin = originInput.trim();
            const origins = pendingOrigin && !form.origins.includes(pendingOrigin) ? [...form.origins, pendingOrigin] : form.origins;
            const result = await readJson<{ widget: Widget; preview_token: string; share_token: string }>(await fetch(endpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ allowed_origins: origins, appearance: form.appearance, daily_session_cap: Number(form.cap) || 500, ...extra }),
            }));
            setOriginInput("");
            queryClient.setQueryData<WidgetPayload>(queryKey, (current) => current ? { ...current, widget: result.widget, preview_token: result.preview_token, share_token: result.share_token } : current);
            return result.widget;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save the widget.");
            return null;
        } finally {
            setBusy(null);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(snippet);
            toast.success("Snippet copied");
        } catch {
            toast.error("Couldn't copy. Select the code and copy it instead.");
        }
    };

    if (query.isLoading || query.isError || !payload || !payload.ready) {
        return (
            <SettingsSection id="website" title="Website" description={<>Put {agent.name} on your website with one script tag.</>}>
                {query.isLoading
                    ? <div className="flex h-24 items-center justify-center text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" /></div>
                    : !payload || query.isError
                        ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load the widget."}</p>
                        : <p className="text-sm text-muted-foreground">{payload.message}</p>}
            </SettingsSection>
        );
    }

    const disabled = !canManage || !!busy;

    return (
        <>
            <SettingsSection
                id="website"
                title="Website"
                description="A chat on your website, added with one script tag. Visitors talk to the published version."
            >
                {!published && (
                    <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">Publish this agent first. The widget always runs the published version.</p>
                )}
                {!canManage && <p className="text-xs text-muted-foreground">Only project admins can change the website widget.</p>}

                <SettingsCard>
                    <SettingsRow label="Website chat" description={widget?.enabled ? "On: visitors to the sites below can chat with the agent." : "Off: the chat doesn't appear anywhere yet."}>
                        <Switch
                            checked={!!widget?.enabled}
                            disabled={disabled || !published}
                            aria-label="Website chat"
                            onCheckedChange={async (checked) => {
                                const next = await save({ enabled: checked }, "toggle");
                                if (next) toast.success(checked ? "Website chat is on" : "Website chat is off");
                            }}
                        />
                    </SettingsRow>
                    <SettingsRow label="Websites" description="The chat only appears on these sites. Use *.example.com to include subdomains." stacked>
                        {form.origins.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                                {form.origins.map((origin) => (
                                    <span key={origin} className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 font-mono text-[11px] ring-1 ring-border/40">
                                        {origin}
                                        <button type="button" disabled={disabled} aria-label={`Remove ${origin}`} onClick={() => setForm((current) => ({ ...current, origins: current.origins.filter((item) => item !== origin) }))} className="text-muted-foreground hover:text-foreground">
                                            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input value={originInput} onChange={(event) => setOriginInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOrigin(); } }} placeholder="example.com" inputMode="url" disabled={disabled} className={settingsInputClass} />
                            <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 text-xs md:h-8" onClick={addOrigin} disabled={disabled || !originInput.trim()}>Add</Button>
                        </div>
                    </SettingsRow>
                    <SettingsRow label="Launcher" description="A card with the agent's orb and heading, or a pill with an icon and text.">
                        <Segmented value={form.appearance.launcher_style} disabled={disabled} onChange={(launcher_style) => update({ launcher_style })} options={[{ value: "card", label: "Card" }, { value: "pill", label: "Pill" }]} />
                    </SettingsRow>
                    <SettingsRow label="Title" description="Shown at the top of the chat.">
                        <input value={form.appearance.title} onChange={(event) => update({ title: event.target.value })} maxLength={60} disabled={disabled} className={cn(settingsInputClass, "md:w-64")} />
                    </SettingsRow>
                    <SettingsRow label={form.appearance.launcher_style === "card" ? "Card heading" : "Button text"} description="What the launcher says.">
                        <input value={form.appearance.launcher_text} onChange={(event) => update({ launcher_text: event.target.value })} maxLength={40} disabled={disabled} className={cn(settingsInputClass, "md:w-64")} />
                    </SettingsRow>
                    <SettingsRow label="Greeting" description="The first message visitors see." stacked>
                        <textarea value={form.appearance.greeting} onChange={(event) => update({ greeting: event.target.value })} maxLength={300} rows={2} disabled={disabled} className={cn(settingsInputClass, "h-auto resize-none py-2 md:h-auto")} />
                    </SettingsRow>
                    <SettingsRow label="Colour" description="The launcher, your messages and buttons.">
                        <div className="flex items-center gap-2">
                            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.appearance.accent) ? form.appearance.accent : "#111111"} onChange={(event) => update({ accent: event.target.value })} disabled={disabled} className="h-8 w-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0" aria-label="Accent colour" />
                            <input value={form.appearance.accent} onChange={(event) => update({ accent: event.target.value })} maxLength={7} disabled={disabled} className={cn(settingsInputClass, "w-28 font-mono")} />
                        </div>
                    </SettingsRow>
                    <SettingsRow label="Theme">
                        <Segmented value={form.appearance.theme} disabled={disabled} onChange={(theme) => update({ theme })} options={[{ value: "auto", label: "Auto" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
                    </SettingsRow>
                    <SettingsRow label="Position" description="Which corner of the page.">
                        <Segmented value={form.appearance.position} disabled={disabled} onChange={(position) => update({ position })} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
                    </SettingsRow>
                    <SettingsRow label="Conversations per day" description="Protects your balance from abuse. Each conversation is also capped at 40 messages, and each connection at 20 new conversations an hour.">
                        <input value={form.cap} onChange={(event) => setForm((current) => ({ ...current, cap: event.target.value.replace(/[^0-9]/g, "") }))} inputMode="numeric" disabled={disabled} className={cn(settingsInputClass, "md:w-28")} />
                    </SettingsRow>
                    <SettingsFooter>
                        {error && <p role="alert" className="mr-auto text-xs text-destructive">{error}</p>}
                        {dirty && <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!!busy} onClick={() => { setForm(saved); setError(null); }}>Discard</Button>}
                        <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" disabled={disabled || (!dirty && !!widget && !originInput.trim())} onClick={async () => { if (await save()) toast.success("Widget saved"); }}>
                            {busy === "save" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            {widget ? "Save" : "Create widget"}
                        </Button>
                    </SettingsFooter>
                </SettingsCard>
            </SettingsSection>

            {widget && (
                <SettingsSection id="website-install" title="Install" description={<>Paste this into your site&apos;s HTML, just before &lt;/body&gt;.</>}>
                    <SettingsCard>
                        <div className="space-y-3 p-4">
                            <Segmented value={snippetMode} onChange={setSnippetMode} options={[{ value: "widget", label: "Launcher" }, { value: "inline", label: "In the page" }]} />
                            <div className="relative">
                                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border/40 bg-background p-3 pr-12 font-mono text-[11px] leading-5">{snippet}</pre>
                                <button type="button" onClick={() => void copy()} aria-label="Copy snippet" className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                                    <HugeiconsIcon icon={Copy01Icon} className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        <SettingsFooter className="justify-between">
                            <p className="text-[11px] text-muted-foreground">The key isn&apos;t secret; the website list keeps it on your sites.</p>
                            <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1.5 text-xs" disabled={disabled} onClick={async () => { if (await save({ rotate_key: true }, "rotate")) toast.success("New key created. Update the snippet on your site."); }}>
                                {busy === "rotate" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                Replace key
                            </Button>
                        </SettingsFooter>
                    </SettingsCard>
                </SettingsSection>
            )}
        </>
    );
}
