"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Wrench01Icon from "@hugeicons/core-free-icons/Wrench01Icon";
import WebhookIcon from "@hugeicons/core-free-icons/WebhookIcon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { postStudioAction, studioQueryKey } from "@/components/agents/studio";
import { cn } from "@/lib/utils";

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
    const { projectId, agent, version, editable, canManage, busy } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const tools = ((version?.config_json.webhook_tools ?? []) as SavedTool[]).filter((tool) => tool && typeof tool.name === "string");
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
        <div className="max-w-3xl">
            <header className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-base font-medium">Tools</h1>
                    <p className="mt-0.5 max-w-lg text-xs text-muted-foreground">
                        Endpoints {agent.name} can call during a conversation, like checking availability or booking a slot. Cencori makes the request and the agent answers from the result.
                    </p>
                </div>
                {canManage && editable && tools.length > 0 && (
                    <Button size="sm" className="h-7 shrink-0 gap-1.5 text-xs" onClick={() => { setError(null); setEditing({ index: null, draft: emptyDraft() }); }} disabled={locked}>
                        <Plus className="h-3.5 w-3.5" />
                        Add tool
                    </Button>
                )}
            </header>

            {!editable && (
                <p className="mb-6 rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    Version {version?.version} is published and locked. Create a new draft to change its tools.
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
