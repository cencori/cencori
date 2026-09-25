"use client";

import { Children, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import AddCircleIcon from "@hugeicons/core-free-icons/AddCircleIcon";
import TestTube01Icon from "@hugeicons/core-free-icons/TestTube01Icon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import PlayCircle02Icon from "@hugeicons/core-free-icons/PlayCircle02Icon";
import Rocket02Icon from "@hugeicons/core-free-icons/Rocket02Icon";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ModelSelect } from "./ModelSelect";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { cn } from "@/lib/utils";
import { useProjectIdBySlug } from "@/lib/hooks/useQueries";
import { getMainSiteUrl } from "@/lib/main-site-url";
import {
    Activity, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Book,
    CircleAlert, Copy, Loader2, Plus, Search, Sparkles, UsersRound,
} from "lucide-react";

type Agent = { id: string; name: string; description: string | null; is_active: boolean; stable_version_id: string | null; created_at: string };
type Version = { id: string; agent_id: string; version: string; status: string; config_json: { model?: string; instructions?: string; system_prompt?: string; [key: string]: unknown }; last_tested_at: string | null; last_test_passed: boolean; published_at: string | null; created_at: string };
type Tenant = { id: string; name: string; external_id: string; status: string };
type Installation = { id: string; agent_id: string; tenant_id: string; agent_version_id: string | null; status: string };
type Run = { id: string; agent_id: string; tenant_id: string | null; status: string; error: string | null; created_at: string };
type Model = { id: string; name: string; provider: string };
type Workspace = { can_manage: boolean; studio_ready: boolean; agents: Agent[]; versions: Version[]; tenants: Tenant[]; installations: Installation[]; runs: Run[]; models: Model[] };
type Form = { name: string; description: string; model: string; instructions: string };
type Tab = "setup" | "customers" | "activity";
type TestMessage = { id: string; role: "user" | "assistant"; content: string; error?: boolean };

const emptyForm: Form = { name: "", description: "", model: "", instructions: "" };
const startingPoints: Array<{ title: string; detail: string; form: Form }> = [
    { title: "Support replies", detail: "Draft a helpful response", form: { name: "Support reply assistant", description: "Draft clear replies to customer questions.", model: "", instructions: "Draft a helpful response to the customer's message. Be concise, acknowledge uncertainty, and do not invent facts about our product." } },
    { title: "Research briefs", detail: "Turn notes into a summary", form: { name: "Research brief assistant", description: "Summarize research notes into a clear brief.", model: "", instructions: "Summarize the notes the user provides. Separate findings from assumptions, cite only information in the notes, and end with open questions." } },
    { title: "Onboarding copy", detail: "Explain the next steps", form: { name: "Onboarding copy assistant", description: "Draft welcoming onboarding messages.", model: "", instructions: "Write a welcoming onboarding message using the context the user gives you. Make the next step easy to understand and avoid promising features not mentioned in the context." } },
];
const inputClass = "w-full rounded-md border border-border/70 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/10";
const labelClass = "mb-2 block text-xs font-medium text-muted-foreground";

function agentStatus(agent: Agent) {
    return !agent.is_active ? "Inactive" : agent.stable_version_id ? "Published" : "Draft";
}

function statusTone(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === "published" || normalized === "completed" || normalized === "active") {
        return { text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
    }
    if (normalized === "draft") {
        return { text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
    }
    if (normalized === "failed" || normalized === "cancelled") {
        return { text: "text-destructive", dot: "bg-destructive" };
    }
    return { text: "text-muted-foreground", dot: "bg-muted-foreground" };
}

function Status({ status }: { status: string }) {
    const tone = statusTone(status);
    return <span className={`inline-flex items-center gap-1.5 text-xs ${tone.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{status.replaceAll("_", " ")}
    </span>;
}

function WorkspaceButton({ children, onClick, disabled, quiet = false, type = "button", iconSide = "left" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; quiet?: boolean; type?: "button" | "submit"; iconSide?: "left" | "right" }) {
    const content = Children.toArray(children);
    const [icon, ...label] = content;
    const segmented = content.length > 1;
    const appearance = quiet
        ? "h-9 border-border bg-background text-xs font-semibold shadow-none hover:bg-accent"
        : "h-7 rounded-md bg-foreground text-[11px] font-medium text-background shadow-none hover:bg-foreground/90";
    const spacing = segmented
        ? "gap-0 overflow-hidden p-0"
        : quiet ? "px-3.5" : "px-3";
    const iconSegment = <span className={`flex shrink-0 self-stretch items-center justify-center ${iconSide === "right" ? "border-l" : "border-r"} border-current/20 ${quiet ? "w-9" : "w-7"}`}>{icon}</span>;
    const labelSegment = <span className={`${quiet ? "px-3.5" : "px-3"} ${iconSide === "right" ? "flex flex-1 items-center justify-center self-stretch" : ""}`}>{label}</span>;

    return <Button
        type={type}
        variant={quiet ? "outline" : "default"}
        onClick={onClick}
        disabled={disabled}
        className={`${appearance} ${spacing}`}
    >
        {segmented
            ? iconSide === "right"
                ? <>{labelSegment}{iconSegment}</>
                : <>{iconSegment}{labelSegment}</>
            : children}
    </Button>;
}

function Field({ label, value, onChange, placeholder, help, textarea = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; help?: string; textarea?: boolean; disabled?: boolean }) {
    return <label className="block">
        <span className={labelClass}>{label}</span>
        {textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} rows={8} className={`${inputClass} min-h-44 resize-y leading-6 disabled:cursor-not-allowed disabled:opacity-50`} /> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`} />}
        {help && <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{help}</span>}
    </label>;
}

export function EmbeddedAgentsDashboard({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
    const { data: projectId, isLoading: projectLoading } = useProjectIdBySlug(orgSlug, projectSlug);
    const queryClient = useQueryClient();
    const queryKey = ["embedded-agent-studio", projectId];
    const workspace = useQuery<Workspace>({
        queryKey,
        enabled: !!projectId,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`);
            if (!response.ok) {
                const payload = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(payload.error || "We couldn't load your agent workspace.");
            }
            return response.json() as Promise<Workspace>;
        },
    });

    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [tab, setTab] = useState<Tab>("setup");
    const [search, setSearch] = useState("");
    const [form, setForm] = useState<Form>(emptyForm);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [testInput, setTestInput] = useState("");
    const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
    const [customerName, setCustomerName] = useState("");
    const [customerId, setCustomerId] = useState("");
    const testComposerRef = useRef<HTMLTextAreaElement>(null);
    const testThreadRef = useRef<HTMLDivElement>(null);
    const trySectionRef = useRef<HTMLDivElement>(null);
    const hydratedSelectionRef = useRef<string | null>(null);

    const data = workspace.data;
    const embeddedAgentsDocsUrl = getMainSiteUrl(
        "/docs/embedded-agents/overview",
    );
    const selectedAgent = data?.agents.find((agent) => agent.id === selectedAgentId) ?? data?.agents[0] ?? null;
    const versions = useMemo(() => data?.versions.filter((version) => version.agent_id === selectedAgent?.id) ?? [], [data?.versions, selectedAgent?.id]);
    const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? versions.find((version) => !["published", "deprecated", "retired"].includes(version.status)) ?? versions[0] ?? null;
    const editable = !!selectedVersion && !["published", "deprecated", "retired"].includes(selectedVersion.status);
    const installedByTenant = new Map(data?.installations.filter((installation) => installation.agent_id === selectedAgent?.id).map((installation) => [installation.tenant_id, installation] as const) ?? []);
    const agentRuns = data?.runs.filter((run) => run.agent_id === selectedAgent?.id) ?? [];
    const filteredAgents = data?.agents.filter((agent) => agent.name.toLowerCase().includes(search.toLowerCase())) ?? [];

    useEffect(() => {
        if (creating) {
            hydratedSelectionRef.current = null;
            return;
        }
        const selectionKey = `${selectedAgent?.id ?? "none"}:${selectedVersion?.id ?? "none"}`;
        if (hydratedSelectionRef.current === selectionKey) return;
        hydratedSelectionRef.current = selectionKey;
        setForm(selectedAgent ? {
            name: selectedAgent.name,
            description: selectedAgent.description ?? "",
            model: selectedVersion?.config_json.model ?? "",
            instructions: selectedVersion?.config_json.instructions ?? selectedVersion?.config_json.system_prompt ?? "",
        } : emptyForm);
        setDirty(false);
        setTestMessages([]);
        setTestInput("");
    }, [creating, selectedAgent, selectedVersion]);

    useEffect(() => {
        testThreadRef.current?.scrollTo({ top: testThreadRef.current.scrollHeight, behavior: "smooth" });
    }, [testMessages, busy]);

    const updateForm = (field: keyof Form, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setDirty(true);
        setError(null);
    };

    const confirmDiscard = () => !dirty || window.confirm("Discard your unsaved changes?");

    const startCreating = (startingForm: Form = emptyForm) => {
        if (!confirmDiscard()) return;
        setCreating(true);
        setForm(startingForm);
        setDirty(false);
        setError(null);
        setTab("setup");
    };

    async function act(action: string, payload: Record<string, unknown> = {}) {
        if (!projectId) return null;
        setBusy(action);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...payload }),
            });
            const result = await response.json().catch(() => ({})) as Record<string, unknown>;
            if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "That didn't work. Try again.");
            await queryClient.invalidateQueries({ queryKey });
            return result;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            return null;
        } finally {
            setBusy(null);
        }
    }

    async function createAgent() {
        const result = await act("create_agent", form);
        if (!result) return;
        setSelectedAgentId(result.agent_id as string);
        setSelectedVersionId(result.version_id as string);
        setCreating(false);
        setTab("setup");
        setDirty(false);
        toast.success("Agent created", { description: "Add instructions, then save and test it." });
    }

    async function saveDraft() {
        if (!selectedAgent || !selectedVersion) return;
        const result = await act("save_draft", { agent_id: selectedAgent.id, version_id: selectedVersion.id, ...form });
        if (result) { setDirty(false); toast.success("Changes saved", { description: "Run a test before publishing." }); }
    }

    async function runTest(message?: string) {
        if (!selectedAgent || !selectedVersion || !projectId) return;
        const input = (message ?? testInput).trim();
        if (!input || !!busy) return;
        const userMessage: TestMessage = { id: `user-${Date.now()}`, role: "user", content: input };
        setTestMessages((current) => [...current, userMessage]);
        setTestInput("");
        if (testComposerRef.current) testComposerRef.current.style.height = "auto";
        setBusy("test_version");
        try {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "test_version", agent_id: selectedAgent.id, version_id: selectedVersion.id, input }),
            });
            const result = await response.json().catch(() => ({})) as Record<string, unknown>;
            if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "That didn't work. Try again.");
            const output = typeof result.output === "string" ? result.output.trim() : "";
            if (!output) throw new Error("The model returned no response. Try again.");
            setTestMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: output }]);
            void queryClient.invalidateQueries({ queryKey });
        } catch (cause) {
            const messageText = cause instanceof Error ? cause.message : "That didn't work. Try again.";
            setTestMessages((current) => [...current, { id: `assistant-error-${Date.now()}`, role: "assistant", content: messageText, error: true }]);
        } finally {
            setBusy(null);
        }
    }

    function handleTestComposerInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
        setTestInput(event.target.value);
        if (testComposerRef.current) {
            testComposerRef.current.style.height = "auto";
            testComposerRef.current.style.height = `${testComposerRef.current.scrollHeight}px`;
        }
    }

    function startNewTestConversation() {
        setTestMessages([]);
        setTestInput("");
        if (testComposerRef.current) {
            testComposerRef.current.style.height = "auto";
            testComposerRef.current.focus();
        }
    }

    function copyTestMessage(content: string) {
        void navigator.clipboard.writeText(content);
        toast.success("Message copied");
    }

    async function publish() {
        if (!selectedAgent || !selectedVersion) return;
        const result = await act("publish_version", { agent_id: selectedAgent.id, version_id: selectedVersion.id });
        if (result) toast.success(`Version ${selectedVersion.version} published`);
    }

    async function newVersion() {
        if (!selectedAgent) return;
        const result = await act("new_version", { agent_id: selectedAgent.id });
        if (result) { setSelectedVersionId(result.version_id as string); setTab("setup"); toast.success("New draft ready", { description: "The published version remains unchanged." }); }
    }

    if (projectLoading || (projectId && workspace.isLoading)) return <div className="grid h-full min-h-0 animate-pulse grid-cols-[240px_1fr] gap-px overflow-hidden bg-border"><div className="bg-sidebar" /><div className="bg-background" /></div>;
    if (!projectId) return <p className="p-8 text-sm text-muted-foreground">Project not found.</p>;
    if (workspace.isError || !data) return <div role="alert" className="flex h-full min-h-0 flex-col justify-center border-l border-destructive/30 p-8"><h2 className="font-semibold">Agent workspace unavailable</h2><p className="mt-2 text-sm text-muted-foreground">{workspace.error instanceof Error ? workspace.error.message : "We couldn't load this project's agents."}</p><button onClick={() => workspace.refetch()} className="mt-4 w-fit text-sm underline">Try again</button></div>;

    const isEmpty = data.agents.length === 0 && !creating;
    const canManage = data.can_manage && data.studio_ready;
    const config = selectedVersion?.config_json;
    const policy = config?.policy as { browser?: { enabled?: boolean }; network?: { mode?: string }; require_approval?: unknown[] } | undefined;
    const simpleVersion = !!config && !["skills", "tools", "connection_requirements", "mcp_tools", "subagents", "knowledge_refs"].some((key) => Array.isArray(config[key]) && (config[key] as unknown[]).length > 0)
        && !policy?.browser?.enabled && policy?.network?.mode !== "allowlist" && !policy?.require_approval?.length
        && !config.input_schema && !config.output_schema && !config.response_format && !config.fallback_policy;
    const visualEditable = editable && simpleVersion;

    return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
        {!data.studio_ready && <div role="status" className="border-b border-border bg-muted/50 px-5 py-3 text-xs leading-5 text-muted-foreground">This database is missing the version-test migration. You can browse agents, but creating, testing, and publishing are paused until it is applied.</div>}
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)] lg:grid-rows-1">
            <aside className="flex max-h-[40dvh] min-h-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:max-h-none lg:border-b-0 lg:border-r">
                <div className="hidden h-12 shrink-0 items-center border-b border-sidebar-border px-5 lg:flex">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Agents</p>
                </div>
                <div className="shrink-0 border-b border-sidebar-border px-5 py-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground lg:hidden">Agents</p>
                    {canManage && <div className="mt-4 lg:mt-0 [&>button]:w-full"><WorkspaceButton iconSide="right" onClick={() => startCreating()}><HugeiconsIcon icon={AddCircleIcon} /> Create agent</WorkspaceButton></div>}
                    {data.agents.length > 0 && <label className="relative mt-3 block"><Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an agent" aria-label="Find an agent" className="h-8 w-full rounded-md border-0 bg-[#f3f3f1] py-2 pl-8 pr-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:bg-[#181818]" /></label>}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                    <nav aria-label="Agents" className="space-y-1">
                        {filteredAgents.map((agent) => <button key={agent.id} type="button" title={agent.name} aria-label={`${agent.name}, ${agentStatus(agent)}`} onClick={() => { if (!confirmDiscard()) return; setCreating(false); setSelectedAgentId(agent.id); setSelectedVersionId(null); setTab("setup"); setError(null); }} className={`w-full rounded-md px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${!creating && selectedAgent?.id === agent.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                            <span className="flex min-w-0 items-center gap-2">
                                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusTone(agentStatus(agent)).dot}`} />
                                <span className="min-w-0 truncate text-sm font-medium">{agent.name}</span>
                            </span>
                        </button>)}
                        {data.agents.length > 0 && filteredAgents.length === 0 && <p className="px-3 py-5 text-xs text-muted-foreground">No agents match that search.</p>}
                    </nav>
                </div>
                <div className="shrink-0 px-5 py-4">
                    <Link
                        href={embeddedAgentsDocsUrl}
                        target="_blank"
                        className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-muted-foreground outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                        <Book className="size-3.5 shrink-0" />
                        <span className="flex-1">API documentation</span>
                        <ArrowUpRight className="size-3 shrink-0" />
                    </Link>
                </div>
            </aside>

            <section aria-label="Agent workspace" className={cn("flex min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain bg-background lg:pt-12", selectedAgent && !creating && tab === "setup" && "xl:overflow-hidden")}>
                {isEmpty ? <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-8 py-12">
                    <span className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted text-foreground"><Sparkles className="h-5 w-5" /></span>
                    <p className="text-xs font-medium text-muted-foreground">A home for the agents in your product</p>
                    <h2 className="mt-3 max-w-md text-4xl font-semibold leading-[1.12] tracking-[-0.06em] text-balance">Start with one agent your customers can use.</h2>
                    <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">Give it instructions, then try it here. When it feels right, publish it and choose which customers get access.</p>
                    <div className="mt-8 flex items-center gap-4">{canManage && <WorkspaceButton onClick={() => startCreating()}><HugeiconsIcon icon={AddCircleIcon} /> Create your first agent</WorkspaceButton>}<Link href={embeddedAgentsDocsUrl} className="text-xs text-muted-foreground hover:text-foreground">Explore the API <ArrowRight className="inline h-3 w-3" /></Link></div>
                    {!canManage && <p className="mt-4 text-xs text-muted-foreground">{data.studio_ready ? "Ask a project admin to create the first agent." : "Agent creation will be available after the database is updated."}</p>}
                    <div className="mt-14 border-t border-border pt-6"><p className="text-xs font-medium text-muted-foreground">A few places to start</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{startingPoints.map((point) => canManage ? <button key={point.title} onClick={() => startCreating(point.form)} className="group rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block text-xs font-medium text-foreground">{point.title} <ArrowUpRight className="inline h-3 w-3 text-muted-foreground group-hover:text-foreground" /></span><span className="mt-2 block text-[11px] leading-5 text-muted-foreground">{point.detail}</span></button> : <div key={point.title} className="rounded-lg border border-border bg-card p-4"><p className="text-xs font-medium text-foreground">{point.title}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{point.detail}</p></div>)}</div></div>
                </div> : creating ? <div className="mx-auto max-w-3xl px-6 py-8 sm:px-10 sm:py-12">
                    <button onClick={() => { if (!confirmDiscard()) return; setCreating(false); setDirty(false); setError(null); }} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to agents</button>
                    <p className="mt-10 text-xs font-medium text-muted-foreground">New agent</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-[-0.055em]">What should this agent do?</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Start simple. You can change the draft before publishing.</p>
                    <form onSubmit={(event) => { event.preventDefault(); void createAgent(); }} className="mt-9 space-y-6">
                        <Field label="Name" value={form.name} onChange={(value) => updateForm("name", value)} placeholder="e.g. Research assistant" />
                        <div className="block"><span className={labelClass}>Model</span><ModelSelect value={form.model} onChange={(value) => updateForm("model", value)} models={data.models} placeholder="Choose a model later" />{data.models.length === 0 && <span className="mt-1.5 block text-xs text-amber-200/70">No available chat models yet. You can create the draft now and choose one later.</span>}</div>
                        <Field label="Instructions" value={form.instructions} onChange={(value) => updateForm("instructions", value)} placeholder="You are a helpful assistant that..." textarea help="Tell the agent what to do, what to avoid, and how to respond." />
                        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
                        <WorkspaceButton type="submit" disabled={!form.name.trim() || !!busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HugeiconsIcon icon={AddCircleIcon} />} Create agent</WorkspaceButton>
                    </form>
                </div> : selectedAgent ? <>
                    <header className="shrink-0 border-b border-border px-6 pb-0 pt-6 sm:px-9">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3"><h2 className="text-xl font-semibold tracking-[-0.05em]">{selectedAgent.name}</h2><Status status={agentStatus(selectedAgent)} /></div>
                            <div className="flex flex-wrap items-center gap-2">
                                {canManage && visualEditable && <WorkspaceButton onClick={() => { trySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); testComposerRef.current?.focus({ preventScroll: true }); }} disabled={!!busy}><HugeiconsIcon icon={PlayCircle02Icon} /> Try agent</WorkspaceButton>}
                                {canManage && visualEditable && selectedVersion?.last_test_passed && !dirty && <WorkspaceButton onClick={() => void publish()} disabled={!!busy}>{busy === "publish_version" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HugeiconsIcon icon={Rocket02Icon} />} Publish</WorkspaceButton>}
                                {canManage && !editable && <WorkspaceButton onClick={() => void newVersion()} disabled={!!busy}><Plus className="h-3.5 w-3.5" /> New draft</WorkspaceButton>}
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-4 overflow-x-auto">
                            {(["setup", "customers", "activity"] as Tab[]).map((item) => <button key={item} onClick={() => { setTab(item); setError(null); }} className={`whitespace-nowrap border-b-2 px-0.5 pb-3 text-xs font-medium capitalize transition-colors ${tab === item ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item}</button>)}
                        </div>
                    </header>

                    <div className={cn("flex min-h-0 flex-1 flex-col px-6 py-6 sm:px-9 sm:py-8", tab === "setup" && "xl:overflow-hidden xl:py-0")}>
                        {error && <div role="alert" className="mb-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs text-destructive"><CircleAlert className="h-4 w-4 shrink-0" />{error}</div>}
                        {tab === "setup" && (() => {
                            const testing = busy === "test_version";
                            const canSend = canManage && !busy && !dirty && !!form.model && !!testInput.trim();
                            return <div className="grid w-full max-w-[1600px] gap-8 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:gap-0">
                                <div className="max-w-2xl space-y-7 xl:min-h-0 xl:max-w-none xl:overflow-y-auto xl:overscroll-contain xl:pb-8 xl:pr-8 xl:pt-8">
                                    <Field label="Name" value={form.name} onChange={(value) => updateForm("name", value)} placeholder="Agent name" disabled={!visualEditable || !canManage} />
                                    <div className="block"><span className={labelClass}>Model</span><ModelSelect value={form.model} onChange={(value) => updateForm("model", value)} models={data.models} disabled={!visualEditable || !canManage} placeholder="Choose a model" /></div>
                                    <Field label="Instructions" value={form.instructions} onChange={(value) => updateForm("instructions", value)} placeholder="Tell this agent how to work..." textarea help="Tell the agent what to do, what to avoid, and how to respond." disabled={!visualEditable || !canManage} />
                                    {!editable && <p className="text-xs text-muted-foreground">This version is locked. Create a new draft to change it.</p>}
                                    {!simpleVersion && <p className="text-xs leading-5 text-amber-500">This version includes advanced tools or skills. Use the API to test and publish those capabilities.</p>}
                                    {visualEditable && canManage && <WorkspaceButton onClick={() => void saveDraft()} disabled={!dirty || !!busy}>{busy === "save_draft" ? "Saving..." : "Save changes"}</WorkspaceButton>}
                                </div>
                                <div ref={trySectionRef} className="flex min-w-0 scroll-mt-6 flex-col border-t border-border pt-8 xl:min-h-0 xl:border-l xl:border-t-0 xl:pl-8">
                                    <div className="mb-5 flex shrink-0 justify-end">
                                        {visualEditable && canManage && <Button type="button" variant="ghost" size="icon" onClick={startNewTestConversation} disabled={!!busy} aria-label="New conversation" title="New conversation" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"><HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" /></Button>}
                                    </div>
                                    {!editable ? <p className="rounded-md border border-border p-5 text-sm text-muted-foreground">Published versions are locked. Create a new draft to run a new test.</p> : !simpleVersion ? <p className="rounded-md border border-amber-500/25 p-5 text-sm text-amber-500">This agent has advanced capabilities. Test this version through the API for now.</p> : <div className="flex min-h-[360px] flex-1 flex-col xl:min-h-0">
                                        <div ref={testThreadRef} className="mx-auto flex min-h-[220px] w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pb-2 xl:min-h-0">
                                            {testMessages.length === 0 && !testing && <div className="my-auto flex flex-col items-center px-6 text-center">
                                                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/70 text-foreground"><HugeiconsIcon icon={TestTube01Icon} className="h-5 w-5" /></span>
                                                <h3 className="text-sm font-semibold text-foreground">Try agent</h3>
                                                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Private test. No customer data or connected apps are used.</p>
                                            </div>}
                                            {testMessages.map((message) => message.role === "user" ? (
                                                <div key={message.id} className="flex flex-col items-end px-1">
                                                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-primary-foreground shadow-sm">
                                                        <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed">{message.content}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={message.id} className="flex flex-col items-start px-1">
                                                    <div className="w-full space-y-2">
                                                        {message.error ? (
                                                            <p role="alert" className="flex items-start gap-2 whitespace-pre-wrap text-sm leading-7 text-destructive"><CircleAlert className="ml-1 mt-1.5 h-4 w-4 shrink-0" />{message.content}</p>
                                                        ) : (
                                                            <MarkdownRenderer content={message.content} />
                                                        )}
                                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground" onClick={() => copyTestMessage(message.content)} title="Copy to clipboard"><Copy className="h-3 w-3" /></Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {testing && (
                                                <div className="flex flex-col items-start px-1">
                                                    <span className="inline-flex items-center gap-[3px] py-2">
                                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mx-auto mt-4 w-full max-w-2xl shrink-0">
                                            <div className="relative flex flex-col rounded-2xl border border-transparent bg-[#f3f3f1] p-3 transition-all hover:bg-[#e9e9e5] focus-within:border-border/60 dark:bg-[#181818] dark:hover:bg-[#212121]">
                                                <textarea ref={testComposerRef} value={testInput} onChange={handleTestComposerInput} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void runTest(); } }} placeholder="Ask this agent to do something its customers would ask..." rows={2} disabled={testing} className="max-h-40 min-h-[48px] w-full resize-none bg-transparent py-1.5 text-base leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none md:text-xs" />
                                                <div className="mt-2 flex items-center justify-end gap-3 select-none">
                                                    <Button type="button" size="icon" onClick={() => void runTest()} disabled={!canSend} aria-label="Send message" className="h-8 w-8 shrink-0 rounded-full bg-foreground text-background transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40">
                                                        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className={cn("h-3.5 w-3.5", !canSend && "opacity-60")} />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>}
                                </div>
                            </div>;
                        })()}

                        {tab === "customers" && <div className="max-w-4xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">Customer access</h3><p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">Install this agent for a customer. Each customer keeps their own data and permissions.</p></div><UsersRound className="h-5 w-5 text-muted-foreground" /></div>
                            {!selectedAgent.stable_version_id && <p className="mt-6 rounded-md border border-amber-200/20 bg-amber-200/[0.04] p-4 text-xs text-amber-200/80">Publish an agent version before giving customers access.</p>}
                            <div className="mt-7 divide-y divide-border border-y border-border">{data.tenants.map((tenant) => <div key={tenant.id} className="flex flex-wrap items-center gap-3 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">{tenant.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{tenant.name}</p><p className="truncate text-xs text-muted-foreground">{tenant.external_id}</p></div>{installedByTenant.has(tenant.id) ? <Status status={installedByTenant.get(tenant.id)?.status ?? "disabled"} /> : canManage && selectedAgent.stable_version_id && tenant.status === "active" ? <WorkspaceButton quiet onClick={async () => { const result = await act("install_agent", { agent_id: selectedAgent.id, tenant_id: tenant.id }); if (result) toast.success("Agent installed", { description: `${selectedAgent.name} is now available to ${tenant.name}.` }); }} disabled={!!busy}>{busy === "install_agent" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Install agent</WorkspaceButton> : <span className="text-xs text-muted-foreground">Not installed</span>}</div>)}{data.tenants.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No customers yet. Add one below to give them access.</p>}</div>
                            {canManage && <form onSubmit={async (event) => { event.preventDefault(); const result = await act("create_tenant", { name: customerName, external_id: customerId }); if (result) { setCustomerName(""); setCustomerId(""); toast.success("Customer added", { description: "You can now install this agent for them." }); } }} className="mt-8 rounded-lg border border-border bg-card p-5"><h4 className="text-sm font-medium">Add a customer</h4><p className="mt-1 text-xs text-muted-foreground">Use the same customer ID your application uses.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Customer name" value={customerName} onChange={setCustomerName} placeholder="e.g. Northstar Health" /><Field label="Customer ID in your app" value={customerId} onChange={setCustomerId} placeholder="e.g. northstar-health" /></div><div className="mt-5"><WorkspaceButton type="submit" disabled={!customerName.trim() || !customerId.trim() || !!busy}>{busy === "create_tenant" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add customer</WorkspaceButton></div></form>}
                        </div>}

                        {tab === "activity" && <div className="max-w-4xl"><div className="flex items-center gap-3"><Activity className="h-5 w-5 text-foreground" /><div><h3 className="text-lg font-semibold">Recent activity</h3><p className="mt-1 text-xs text-muted-foreground">The latest runs for this agent.</p></div></div><div className="mt-7 divide-y divide-border border-y border-border">{agentRuns.map((run) => <div key={run.id} className="flex flex-wrap items-center gap-4 py-4"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted"><Activity className="h-3.5 w-3.5 text-muted-foreground" /></span><div className="min-w-0 flex-1"><p className="text-sm">{data.tenants.find((tenant) => tenant.id === run.tenant_id)?.name ?? "Agent run"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{run.error || new Date(run.created_at).toLocaleString()}</p></div><Status status={run.status} /></div>)}{agentRuns.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No runs yet. Customer activity will appear here.</p>}</div></div>}
                    </div>
                </> : null}
            </section>
        </div>
    </div>;
}
