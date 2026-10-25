"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Wrench01Icon from "@hugeicons/core-free-icons/Wrench01Icon";
import WebhookIcon from "@hugeicons/core-free-icons/WebhookIcon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { DockedPanel } from "@/components/agents/DockedPanel";
import { AgentMcp } from "@/components/agents/AgentMcp";
import { AgentIntegrations } from "@/components/agents/AgentIntegrations";
import { postStudioAction, studioQueryKey } from "@/components/agents/studio";
import { cn } from "@/lib/utils";
import { END_CONVERSATION_TOOL, SYSTEM_TOOL_DEFAULT_DESCRIPTIONS, TRANSFER_TO_HUMAN_TOOL } from "@/lib/embedded/system-tool-defaults";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const PARAM_TYPES = ["string", "number", "boolean"] as const;

type Method = (typeof METHODS)[number];
type ParamType = (typeof PARAM_TYPES)[number];
type Param = { name: string; type: ParamType; description: string; required: boolean };
/** A header the server already holds (`saved`, value never sent here) or a new one. */
type Header = { name: string; value: string; saved: boolean };
/** As the console receives a tool: header names only. */
type SavedTool = { name: string; description: string; method: Method; url: string; headers: Array<{ name: string }>; parameters: Param[] };
type Draft = { name: string; description: string; method: Method; url: string; headers: Header[]; parameters: Param[]; previousName?: string };

const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring disabled:cursor-not-allowed disabled:opacity-60";

const emptyDraft = (): Draft => ({ name: "", description: "", method: "POST", url: "", headers: [], parameters: [] });

function toDraft(tool: SavedTool): Draft {
    return { ...tool, previousName: tool.name, headers: tool.headers.map((h) => ({ name: h.name, value: "", saved: true })), parameters: tool.parameters.map((p) => ({ ...p })) };
}

/** What the server expects: saved headers are kept by name, new ones carry their value. */
function toPayload(tool: SavedTool | Draft) {
    return {
        name: tool.name,
        previous_name: "previousName" in tool ? tool.previousName : tool.name,
        description: tool.description,
        method: tool.method,
        url: tool.url,
        headers: tool.headers.map((h) => ("saved" in h && h.saved && !h.value ? { name: h.name, keep: true } : "value" in h ? { name: h.name, value: h.value } : { name: h.name, keep: true })),
        parameters: tool.parameters,
    };
}

function hostOf(url: string) {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/** The agent's tools: webhooks it can call mid-conversation. */
export function AgentTools() {
    const { projectId, agent, version, editable, canManage, busy, data, form } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const tools = ((version?.config_json.webhook_tools ?? []) as SavedTool[]).filter((tool) => tool && typeof tool.name === "string");
    // Cohere models don't take tools through the gateway yet; say so rather than let tools sit unused.
    const modelProvider = data.models.find((model) => model.id === form.model)?.provider;
    const hasAnyTools = tools.length > 0 || Object.keys((version?.config_json.system_tools ?? {}) as object).length > 0 || ((version?.config_json.mcp_servers ?? []) as unknown[]).length > 0;
    // `?tab=integrations` opens on that tab (the setup checklist links there).
    const initialTab = useSearchParams().get("tab");
    const [tab, setTab] = useState<"tools" | "integrations" | "mcp">(initialTab === "integrations" || initialTab === "mcp" ? initialTab : "tools");
    const [mcpAdding, setMcpAdding] = useState(false);
    const [appsAdding, setAppsAdding] = useState(false);
    const appCount = Array.isArray(version?.config_json.integrations) ? (version.config_json.integrations as unknown[]).length : 0;
    const mcpServerCount = Array.isArray(version?.config_json.mcp_servers) ? (version.config_json.mcp_servers as unknown[]).length : 0;
    const [editing, setEditing] = useState<{ index: number | null; draft: Draft } | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const locked = !editable || !canManage || !!busy;

    const save = async (next: Array<SavedTool | Draft>, message: string) => {
        if (!version) return false;
        setSaving(true);
        setError(null);
        try {
            await postStudioAction(projectId, "save_tools", { agent_id: agent.id, version_id: version.id, webhook_tools: next.map(toPayload) });
            await queryClient.invalidateQueries({ queryKey: studioQueryKey(projectId) });
            toast.success(message);
            return true;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save the tools. Try again.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const submit = async () => {
        if (!editing) return;
        const next: Array<SavedTool | Draft> = [...tools];
        if (editing.index === null) next.push(editing.draft);
        else next[editing.index] = editing.draft;
        if (await save(next, editing.index === null ? `${editing.draft.name} added` : `${editing.draft.name} saved`)) setEditing(null);
    };

    const remove = async (index: number) => {
        const name = tools[index]?.name;
        await save(tools.filter((_, i) => i !== index), `${name} removed`);
    };

    return (
        <div>
            <header className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-base font-medium">Tools</h1>
                    <div role="tablist" aria-label="Tool type" className="mt-3 grid grid-cols-3 rounded-md bg-muted/60 p-0.5 text-xs">
                        {(["tools", "integrations", "mcp"] as const).map((value) => (
                            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setMcpAdding(false); setAppsAdding(false); }} className={cn("rounded px-3 py-1 transition-colors", tab === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                                {value === "tools" ? "Tools" : value === "integrations" ? "Integrations" : "MCP"}
                            </button>
                        ))}
                    </div>
                </div>
                {tab === "integrations" && canManage && editable && appCount > 0 && (
                    <Button size="sm" className="h-7 shrink-0 gap-1.5 text-xs" onClick={() => setAppsAdding(true)} disabled={!!busy || appsAdding}>
                        <Plus className="h-3.5 w-3.5" />
                        Add integration
                    </Button>
                )}
                {tab === "mcp" && canManage && editable && mcpServerCount > 0 && (
                    <Button size="sm" className="h-7 shrink-0 gap-1.5 text-xs" onClick={() => setMcpAdding(true)} disabled={!!busy || mcpAdding}>
                        <Plus className="h-3.5 w-3.5" />
                        Add server
                    </Button>
                )}
                {tab === "tools" && canManage && editable && tools.length > 0 && (
                    <Button size="sm" className="h-7 shrink-0 gap-1.5 text-xs" onClick={() => { setError(null); setEditing({ index: null, draft: emptyDraft() }); }} disabled={locked}>
                        <Plus className="h-3.5 w-3.5" />
                        Add tool
                    </Button>
                )}
            </header>

            {tab === "integrations" ? (
                <AgentIntegrations key={version?.id ?? "none"} adding={appsAdding} onAddingChange={setAppsAdding} />
            ) : tab === "mcp" ? (
                <AgentMcp key={version?.id ?? "none"} adding={mcpAdding} onAddingChange={setMcpAdding} />
            ) : (
                <>
                {modelProvider === "cohere" && hasAnyTools && (
                <p className="mb-4 rounded-md border border-amber-500/25 px-4 py-3 text-xs leading-5 text-amber-600 dark:text-amber-400">
                    Cohere models can&apos;t use tools yet, so {agent.name} answers without them. Pick another model on the Agent page to use these tools.
                </p>
            )}
            {error && !editing && <p role="alert" className="mb-4 text-xs text-destructive">{error}</p>}

                {tools.length === 0 ? (
                    <div className="flex flex-col items-center rounded-lg border border-border/60 px-6 py-14 text-center">
                        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/70 text-foreground"><HugeiconsIcon icon={Wrench01Icon} className="h-5 w-5" /></span>
                        <p className="text-sm font-medium">No tools yet</p>
                        <p className="mt-1 max-w-[40ch] text-xs leading-5 text-muted-foreground">Give {agent.name} an endpoint to call, and it can act on what people ask instead of only answering.</p>
                        {canManage && editable && (
                            <Button size="sm" className="mt-4 h-7 gap-1.5 text-xs" onClick={() => { setError(null); setEditing({ index: null, draft: emptyDraft() }); }} disabled={locked}>
                                <Plus className="h-3.5 w-3.5" />
                                Add tool
                            </Button>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                        {tools.map((tool, index) => (
                            <li key={tool.name} className="flex items-center gap-3 px-4 py-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/70"><HugeiconsIcon icon={WebhookIcon} className="h-4 w-4" /></span>
                                <button type="button" className="min-w-0 flex-1 text-left disabled:cursor-default" onClick={() => { setError(null); setEditing({ index, draft: toDraft(tool) }); }} disabled={!canManage}>
                                    <p className="truncate font-mono text-[13px] font-medium">{tool.name}</p>
                                    <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{tool.method}</span> {hostOf(tool.url)} · {tool.description}</p>
                                </button>
                                {canManage && editable && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void remove(index)} disabled={locked || saving} aria-label={`Remove ${tool.name}`} title="Remove">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <SystemTools key={version?.id ?? "none"} />
                </>
            )}

            <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-medium">{editing?.index === null ? "Add webhook tool" : "Edit webhook tool"}</DialogTitle>
                        <DialogDescription className="text-xs leading-5">
                            The agent decides when to call it from the name and description, and fills in the inputs from the conversation.
                        </DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <ToolForm
                            draft={editing.draft}
                            onChange={(draft) => setEditing({ ...editing, draft })}
                            disabled={locked || saving}
                        />
                    )}
                    {error && editing && <p role="alert" className="text-xs text-destructive">{error}</p>}
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                        {canManage && editable && (
                            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void submit()} disabled={locked || saving}>
                                {saving && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                {editing?.index === null ? "Add tool" : "Save"}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-medium">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
        </label>
    );
}

function ToolForm({ draft, onChange, disabled }: { draft: Draft; onChange: (draft: Draft) => void; disabled: boolean }) {
    const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
    const setHeader = (index: number, patch: Partial<Header>) => set({ headers: draft.headers.map((h, i) => (i === index ? { ...h, ...patch } : h)) });
    const setParam = (index: number, patch: Partial<Param>) => set({ parameters: draft.parameters.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

    return (
        <div className="space-y-5">
            <Field label="Name" hint="Letters, numbers and underscores, like check_availability.">
                <input value={draft.name} onChange={(event) => set({ name: event.target.value.replace(/[^A-Za-z0-9_]/g, "_") })} disabled={disabled} placeholder="book_meeting" className={cn(inputClass, "font-mono")} autoFocus />
            </Field>
            <Field label="Description" hint="When to use it and what it does. This is what the agent reads.">
                <textarea value={draft.description} onChange={(event) => set({ description: event.target.value })} disabled={disabled} rows={3} placeholder="Books a demo once the visitor has picked a time. Returns the confirmed slot." className={cn(inputClass, "resize-y")} />
            </Field>
            <div>
                <span className="mb-1.5 block text-xs font-medium">Endpoint</span>
                <div className="flex gap-2">
                    <Select value={draft.method} onValueChange={(value) => set({ method: value as Method })} disabled={disabled}>
                        <SelectTrigger className="h-[38px] w-[110px] shrink-0 font-mono text-xs shadow-none"><SelectValue /></SelectTrigger>
                        <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <input value={draft.url} onChange={(event) => set({ url: event.target.value.trim() })} disabled={disabled} placeholder="https://api.example.com/book" className={cn(inputClass, "font-mono text-[13px]")} />
                </div>
                <span className="mt-1 block text-[11px] text-muted-foreground">{draft.method === "GET" || draft.method === "DELETE" ? "Inputs are sent as query parameters." : "Inputs are sent as a JSON body."}</span>
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium">Inputs</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => set({ parameters: [...draft.parameters, { name: "", type: "string", description: "", required: true }] })} disabled={disabled}>
                        <Plus className="h-3 w-3" /> Add input
                    </Button>
                </div>
                {draft.parameters.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-[11px] text-muted-foreground">No inputs. The endpoint is called without any.</p>
                ) : (
                    <div className="space-y-2">
                        {draft.parameters.map((param, index) => (
                            <div key={index} className="rounded-md border border-border/50 p-2.5">
                                <div className="flex gap-2">
                                    <input value={param.name} onChange={(event) => setParam(index, { name: event.target.value.replace(/[^A-Za-z0-9_]/g, "_") })} disabled={disabled} placeholder="time" aria-label="Input name" className={cn(inputClass, "py-1.5 font-mono text-xs")} />
                                    <Select value={param.type} onValueChange={(value) => setParam(index, { type: value as ParamType })} disabled={disabled}>
                                        <SelectTrigger className="h-[30px] w-[110px] shrink-0 text-xs shadow-none"><SelectValue /></SelectTrigger>
                                        <SelectContent>{PARAM_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button type="button" variant="ghost" size="icon" className="h-[30px] w-[30px] shrink-0 text-muted-foreground hover:text-destructive" onClick={() => set({ parameters: draft.parameters.filter((_, i) => i !== index) })} disabled={disabled} aria-label="Remove input">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                <div className="mt-2 flex items-center gap-3">
                                    <input value={param.description} onChange={(event) => setParam(index, { description: event.target.value })} disabled={disabled} placeholder="What it is, e.g. the start time in ISO 8601" aria-label="Input description" className={cn(inputClass, "py-1.5 text-xs")} />
                                    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Switch checked={param.required} onCheckedChange={(checked) => setParam(index, { required: checked })} disabled={disabled} />
                                        Required
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium">Headers</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => set({ headers: [...draft.headers, { name: "", value: "", saved: false }] })} disabled={disabled}>
                        <Plus className="h-3 w-3" /> Add header
                    </Button>
                </div>
                {draft.headers.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-[11px] text-muted-foreground">Add one for an API key, like Authorization. Values are encrypted and never shown again.</p>
                ) : (
                    <div className="space-y-2">
                        {draft.headers.map((header, index) => (
                            <div key={index} className="flex gap-2">
                                <input value={header.name} onChange={(event) => setHeader(index, { name: event.target.value, saved: false })} disabled={disabled || header.saved} placeholder="Authorization" aria-label="Header name" className={cn(inputClass, "w-[40%] py-1.5 font-mono text-xs")} />
                                <input
                                    type="password"
                                    value={header.value}
                                    onChange={(event) => setHeader(index, { value: event.target.value })}
                                    disabled={disabled}
                                    placeholder={header.saved ? "Saved · type to replace" : "Bearer …"}
                                    aria-label="Header value"
                                    autoComplete="off"
                                    className={cn(inputClass, "py-1.5 font-mono text-xs")}
                                />
                                <Button type="button" variant="ghost" size="icon" className="h-[30px] w-[30px] shrink-0 text-muted-foreground hover:text-destructive" onClick={() => set({ headers: draft.headers.filter((_, i) => i !== index) })} disabled={disabled} aria-label="Remove header">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

type SystemToolsConfig = {
    end_conversation?: { description?: string } | true;
    transfer_to_human?: { url: string; description?: string; rules?: string[] } | null;
};
type SystemToolKey = "end_conversation" | "transfer_to_human";
type SystemToolDraft = { description: string; url: string; rules: string[] };

const SYSTEM_TOOLS: Array<{ key: SystemToolKey; label: string; summary: string }> = [
    { key: END_CONVERSATION_TOOL, label: "End conversation", summary: "Closes the chat once the person is done, so the next message starts fresh." },
    { key: TRANSFER_TO_HUMAN_TOOL, label: "Transfer to a person", summary: "Takes their contact details and a summary, and sends them to your team's URL with the conversation so far." },
];

/** The saved settings as the server expects them back. */
function systemPayload(saved: SystemToolsConfig): Record<SystemToolKey, unknown> {
    const end = saved.end_conversation;
    return {
        end_conversation: end ? (end === true ? {} : end) : null,
        transfer_to_human: saved.transfer_to_human ?? null,
    };
}

/** Built-in actions the agent can take, switched on per version, each with its own settings. */
function SystemTools() {
    const { projectId, agent, version, editable, canManage, busy } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const saved = (version?.config_json.system_tools ?? {}) as SystemToolsConfig;
    const [editing, setEditing] = useState<{ key: SystemToolKey; draft: SystemToolDraft } | null>(null);
    const [saving, setSaving] = useState<SystemToolKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const locked = !editable || !canManage || !!busy || !!saving;
    const isOn = (key: SystemToolKey) => !!saved[key];
    
    const save = async (key: SystemToolKey, value: unknown, message: string) => {
        if (!version) return false;
        setSaving(key);
        setError(null);
        try {
            await postStudioAction(projectId, "save_tools", { agent_id: agent.id, version_id: version.id, system_tools: { ...systemPayload(saved), [key]: value } });
            await queryClient.invalidateQueries({ queryKey: studioQueryKey(projectId) });
            toast.success(message);
            return true;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save. Try again.");
            return false;
        } finally {
            setSaving(null);
        }
    };

    const open = (key: SystemToolKey) => {
        const current = saved[key];
        const settings = current && current !== true ? current : {};
        setError(null);
        setEditing({
            key,
            draft: {
                description: (settings as { description?: string }).description ?? "",
                url: (settings as { url?: string }).url ?? "",
                rules: [...((settings as { rules?: string[] }).rules ?? [])],
            },
        });
    };

    const toggle = (key: SystemToolKey, checked: boolean) => {
        const label = SYSTEM_TOOLS.find((tool) => tool.key === key)?.label ?? key;
        // A hand-off needs somewhere to go: turning it on asks for the URL first.
        if (checked && key === TRANSFER_TO_HUMAN_TOOL) return open(key);
        void save(key, checked ? (systemPayload(saved)[key] ?? {}) : null, `${label} is ${checked ? "on" : "off"}`);
    };

    const submit = async () => {
        if (!editing) return;
        const { key, draft } = editing;
        const label = SYSTEM_TOOLS.find((tool) => tool.key === key)?.label ?? key;
        const value = key === TRANSFER_TO_HUMAN_TOOL
            ? { url: draft.url.trim(), description: draft.description.trim(), rules: draft.rules.map((rule) => rule.trim()).filter(Boolean) }
            : { description: draft.description.trim() };
        if (await save(key, value, `${label} saved`)) setEditing(null);
    };

    return (
        <section className="mt-8">
            <h2 className="text-sm font-medium">System tools</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Built-in actions {agent.name} can take on its own.</p>
            <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                {SYSTEM_TOOLS.map((tool) => (
                    <li key={tool.key} className="flex items-start justify-between gap-4 px-4 py-3">
                        <div>
                            <p className="text-sm">{tool.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{tool.summary}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {isOn(tool.key) && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => open(tool.key)} aria-label={`${tool.label} settings`} title="Settings">
                                    {saving === tool.key ? <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                                </Button>
                            )}
                            <Switch checked={isOn(tool.key)} disabled={locked} aria-label={tool.label} onCheckedChange={(checked) => toggle(tool.key, checked)} />
                        </div>
                    </li>
                ))}
            </ul>
            {error && !editing && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}

            <DockedPanel open={!!editing} onOpenChange={(next) => { if (!next && !saving) setEditing(null); }}>
                {editing && (
                    <SystemToolForm
                        toolKey={editing.key}
                        draft={editing.draft}
                        onChange={(draft) => setEditing({ ...editing, draft })}
                        disabled={locked}
                        error={error}
                        saving={saving === editing.key}
                        onCancel={() => setEditing(null)}
                        onSave={() => void submit()}
                        canSave={canManage && editable && (editing.key !== TRANSFER_TO_HUMAN_TOOL || !!editing.draft.url.trim())}
                    />
                )}
            </DockedPanel>
        </section>
    );
}

function SystemToolForm({ toolKey, draft, onChange, disabled, error, saving, onCancel, onSave, canSave }: {
    toolKey: SystemToolKey;
    draft: SystemToolDraft;
    onChange: (draft: SystemToolDraft) => void;
    disabled: boolean;
    error: string | null;
    saving: boolean;
    onCancel: () => void;
    onSave: () => void;
    canSave: boolean;
}) {
    const [showDefault, setShowDefault] = useState(false);
    const set = (patch: Partial<SystemToolDraft>) => onChange({ ...draft, ...patch });
    const isTransfer = toolKey === TRANSFER_TO_HUMAN_TOOL;
    const label = SYSTEM_TOOLS.find((tool) => tool.key === toolKey)?.label ?? toolKey;

    return (
        <>
            <SheetHeader className="border-b border-border/60 px-5 py-4">
                <SheetTitle className="text-base font-medium">{label}</SheetTitle>
                <SheetDescription className="text-xs">Tell the agent how and when to use it.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <Field label="Name">
                    <input value={toolKey} readOnly disabled className={cn(inputClass, "font-mono text-[13px]")} />
                </Field>
                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
                        <button type="button" className="rounded text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline" onClick={() => setShowDefault((value) => !value)}>
                            {showDefault ? "Hide default" : "Show default"}
                        </button>
                    </div>
                    <textarea
                        value={draft.description}
                        onChange={(event) => set({ description: event.target.value })}
                        disabled={disabled}
                        rows={4}
                        placeholder="Leave blank to use the default."
                        className={cn(inputClass, "resize-y")}
                    />
                    {showDefault && (
                        <p className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">{SYSTEM_TOOL_DEFAULT_DESCRIPTIONS[toolKey]}</p>
                    )}
                </div>

                {isTransfer && (
                    <>
                        <Field label="Hand-off URL" hint="We POST the person's contact details, a summary and the conversation here as JSON.">
                            <input value={draft.url} onChange={(event) => set({ url: event.target.value })} disabled={disabled} placeholder="https://hooks.example.com/handoff" className={cn(inputClass, "font-mono text-[13px]")} />
                        </Field>
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-medium">Transfer rules</span>
                                    <p className="text-[11px] text-muted-foreground">When else the agent should hand off, besides being asked.</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => set({ rules: [...draft.rules, ""] })} disabled={disabled || draft.rules.length >= 10}>
                                    <Plus className="h-3 w-3" /> Add rule
                                </Button>
                            </div>
                            {draft.rules.length > 0 && (
                                <div className="space-y-2">
                                    {draft.rules.map((rule, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                value={rule}
                                                onChange={(event) => set({ rules: draft.rules.map((r, i) => (i === index ? event.target.value : r)) })}
                                                disabled={disabled}
                                                placeholder="They ask about a contract or invoice"
                                                aria-label={`Rule ${index + 1}`}
                                                className={cn(inputClass, "py-1.5 text-xs")}
                                            />
                                            <Button type="button" variant="ghost" size="icon" className="h-[30px] w-[30px] shrink-0 text-muted-foreground hover:text-destructive" onClick={() => set({ rules: draft.rules.filter((_, i) => i !== index) })} disabled={disabled} aria-label="Remove rule">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t border-border/60 px-5 py-3">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={saving}>Cancel</Button>
                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={onSave} disabled={disabled || !canSave}>
                    {saving && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                    Save
                </Button>
            </SheetFooter>
        </>
    );
}
