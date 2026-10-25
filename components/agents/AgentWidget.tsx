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
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-md bg-[#f3f3f1] px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:bg-[#ececea] dark:bg-[#181818] dark:focus:bg-[#1f1f1f] disabled:opacity-60";
const FALLBACK_LOOK: WidgetAppearance = { title: "Assistant", greeting: "Hi! How can I help?", launcher_text: "Need help?", accent: "#111111", theme: "auto", position: "right", launcher_style: "card" };

type Form = { origins: string[]; appearance: WidgetAppearance; cap: string };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-medium">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
        </label>
    );
}

function Segmented<T extends string>({ value, options, onChange, disabled }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; disabled?: boolean }) {
    return (
        <div className={cn("grid rounded-md bg-muted/60 p-0.5 text-xs", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {options.map((option) => (
                <button key={option.value} type="button" disabled={disabled} onClick={() => onChange(option.value)} className={cn("rounded px-3 py-1.5 transition-colors", value === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {option.label}
                </button>
            ))}
        </div>
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

    if (query.isLoading) {
        return <div className="flex h-40 items-center justify-center text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" /></div>;
    }
    if (query.isError || !payload) {
        return <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load the widget."}</p>;
    }
    if (!payload.ready) {
        return <p className="text-sm text-muted-foreground">{payload.message}</p>;
    }

    const disabled = !canManage || !!busy;

    return (
        <div className="space-y-5">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-medium">Website</h2>
                    <p className="mt-0.5 max-w-lg text-xs text-muted-foreground">
                        Put {agent.name} on your website with one script tag. Visitors chat with the published version and its knowledge. Try it in the Widget tab of the test panel.
                    </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs">
                    <span className={widget?.enabled ? "text-foreground" : "text-muted-foreground"}>{widget?.enabled ? "On" : "Off"}</span>
                    <Switch
                        checked={!!widget?.enabled}
                        disabled={disabled || !published}
                        onCheckedChange={async (checked) => {
                            const next = await save({ enabled: checked }, "toggle");
                            if (next) toast.success(checked ? "Widget is on" : "Widget is off");
                        }}
                    />
                </label>
            </header>

            {!published && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    Publish this agent first. The widget always runs the published version.
                </p>
            )}
            {!canManage && <p className="text-xs text-muted-foreground">Only project admins can change the website widget.</p>}

            <Section title="Websites" description="The chat only appears on these sites. Use *.example.com to include subdomains.">
                {form.origins.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {form.origins.map((origin) => (
                            <span key={origin} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-mono text-[11px]">
                                {origin}
                                <button type="button" disabled={disabled} aria-label={`Remove ${origin}`} onClick={() => setForm((current) => ({ ...current, origins: current.origins.filter((item) => item !== origin) }))} className="text-muted-foreground hover:text-foreground">
                                    <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <input
                        value={originInput}
                        onChange={(event) => setOriginInput(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOrigin(); } }}
                        placeholder="example.com"
                        inputMode="url"
                        disabled={disabled}
                        className={inputClass}
                    />
                    <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 text-xs" onClick={addOrigin} disabled={disabled || !originInput.trim()}>Add</Button>
                </div>
            </Section>

            <Section title="Look" description="Changes show in the test panel as you make them. Visitors see them once you save.">
                <Field label="Launcher">
                    <div className="max-w-[260px]">
                        <Segmented value={form.appearance.launcher_style} disabled={disabled} onChange={(launcher_style) => update({ launcher_style })} options={[{ value: "card", label: "Card" }, { value: "pill", label: "Pill" }]} />
                    </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Title" hint="Shown at the top of the chat."><input value={form.appearance.title} onChange={(event) => update({ title: event.target.value })} maxLength={60} disabled={disabled} className={inputClass} /></Field>
                    <Field label={form.appearance.launcher_style === "card" ? "Card heading" : "Button text"}><input value={form.appearance.launcher_text} onChange={(event) => update({ launcher_text: event.target.value })} maxLength={40} disabled={disabled} className={inputClass} /></Field>
                </div>
                <Field label="Greeting" hint="The first message visitors see.">
                    <textarea value={form.appearance.greeting} onChange={(event) => update({ greeting: event.target.value })} maxLength={300} rows={2} disabled={disabled} className={cn(inputClass, "resize-none")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Colour">
                        <div className="flex items-center gap-2">
                            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.appearance.accent) ? form.appearance.accent : "#111111"} onChange={(event) => update({ accent: event.target.value })} disabled={disabled} className="h-9 w-10 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0" aria-label="Accent colour" />
                            <input value={form.appearance.accent} onChange={(event) => update({ accent: event.target.value })} maxLength={7} disabled={disabled} className={cn(inputClass, "font-mono")} />
                        </div>
                    </Field>
                    <Field label="Theme">
                        <Segmented value={form.appearance.theme} disabled={disabled} onChange={(theme) => update({ theme })} options={[{ value: "auto", label: "Auto" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
                    </Field>
                    <Field label="Position">
                        <Segmented value={form.appearance.position} disabled={disabled} onChange={(position) => update({ position })} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
                    </Field>
                </div>
            </Section>

            <Section title="Limits" description="Protects your balance from abuse. Visitors are anonymous.">
                <Field label="Conversations per day" hint="New conversations stop for the day once this is reached. Each conversation is also capped at 40 messages, and each connection at 20 new conversations an hour.">
                    <input value={form.cap} onChange={(event) => setForm((current) => ({ ...current, cap: event.target.value.replace(/[^0-9]/g, "") }))} inputMode="numeric" disabled={disabled} className={cn(inputClass, "max-w-[160px]")} />
                </Field>
            </Section>

            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-3">
                {dirty && <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!!busy} onClick={() => { setForm(saved); setError(null); }}>Discard</Button>}
                <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled || (!dirty && !!widget && !originInput.trim())} onClick={async () => { if (await save()) toast.success("Widget saved"); }}>
                    {busy === "save" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                    {widget ? "Save" : "Create widget"}
                </Button>
            </div>

            {widget && (
                <Section title="Install" description="Paste this into your site's HTML, just before </body>.">
                    <div className="max-w-[260px]">
                        <Segmented value={snippetMode} onChange={setSnippetMode} options={[{ value: "widget", label: "Launcher" }, { value: "inline", label: "In the page" }]} />
                    </div>
                    <div className="relative">
                        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-[#f3f3f1] p-3 pr-12 font-mono text-[11px] leading-5 dark:bg-[#181818]">{snippet}</pre>
                        <button type="button" onClick={() => void copy()} aria-label="Copy snippet" className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
                            <HugeiconsIcon icon={Copy01Icon} className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[11px] text-muted-foreground">The key isn&apos;t secret; the website list keeps it on your sites. Replace it if it&apos;s being misused.</p>
                        <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" disabled={disabled} onClick={async () => { if (await save({ rotate_key: true }, "rotate")) toast.success("New key created. Update the snippet on your site."); }}>
                            {busy === "rotate" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            Replace key
                        </Button>
                    </div>
                </Section>
            )}
        </div>
    );
}
