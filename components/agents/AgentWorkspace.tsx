"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/lib/console/unsaved-changes";
import {
    emptyAgentForm,
    isLockedVersion,
    isSimpleVersion,
    applyStudioResult,
    postStudioAction,
    studioQueryKey,
    useAgentStudio,
    workingVersion,
    type Agent,
    type AgentForm,
    type Version,
    type Workspace,
} from "@/components/agents/studio";

export type ToolActivity = { id: string; name: string; status: "running" | "done" | "failed" };
/** `ended`: the agent closed the conversation with this reply; what follows starts fresh. */
/** The reply in the order it happened: runs of text between tool calls. */
export type TestStep = { type: "text"; text: string } | { type: "tool"; id: string };
export type TestMessage = { id: string; role: "user" | "assistant"; content: string; error?: boolean; tools?: ToolActivity[]; steps?: TestStep[]; ended?: boolean; startedAt?: number; durationMs?: number };

interface AgentWorkspaceValue {
    projectId: string;
    data: Workspace;
    agent: Agent;
    versions: Version[];
    version: Version | null;
    selectVersion: (id: string | null) => void;
    canManage: boolean;
    /** The working version is a draft that the form can edit. */
    editable: boolean;
    /** Editable here (not an API-only version with tools, skills or policies). */
    visualEditable: boolean;
    simpleVersion: boolean;
    form: AgentForm;
    dirty: boolean;
    updateForm: (field: keyof AgentForm, value: string) => void;
    busy: string | null;
    error: string | null;
    setError: (error: string | null) => void;
    act: (action: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    saveDraft: () => Promise<boolean>;
    /** Publishes the working version; `releaseNotes` is the Review changes note. */
    publish: (releaseNotes?: string) => Promise<boolean>;
    /** Throws away unsaved edits and reloads the saved draft. */
    discardChanges: () => void;
    /** The live version customers get, if any. */
    publishedVersion: Version | null;
    newVersion: () => Promise<void>;
    setVisibility: (visibility: string) => Promise<void>;
    test: {
        messages: TestMessage[];
        input: string;
        setInput: (value: string) => void;
        run: (message?: string) => Promise<void>;
        reset: () => void;
        focusRequest: number;
        requestFocus: () => void;
    };
}

const VISIBILITY_LABELS: Record<string, string> = { private: "Private", tenant: "Customers only", unlisted: "Unlisted", public: "Public" };

const AgentWorkspaceContext = createContext<AgentWorkspaceValue | null>(null);

export function useAgentWorkspace(): AgentWorkspaceValue {
    const value = useContext(AgentWorkspaceContext);
    if (!value) throw new Error("useAgentWorkspace must be used inside AgentWorkspaceProvider");
    return value;
}

type ProviderState =
    | { status: "loading" }
    | { status: "error"; message: string; retry: () => void }
    | { status: "missing" }
    | { status: "ready" };

/**
 * One agent's editing session, shared by all of its sections (Overview, Agent,
 * Runs, Customers, Marketplace) and the docked test panel. Lives in the agent's
 * layout, so moving between sections keeps unsaved edits and the test chat.
 */
export function AgentWorkspaceProvider({
    projectId,
    agentId,
    children,
    fallback,
}: {
    projectId: string;
    agentId: string;
    children: ReactNode;
    fallback: (state: Exclude<ProviderState, { status: "ready" }>) => ReactNode;
}) {
    const queryClient = useQueryClient();
    const queryKey = studioQueryKey(projectId);
    const workspace = useAgentStudio(projectId);
    const data = workspace.data;

    const agent = data?.agents.find((item) => item.id === agentId) ?? null;
    const versions = useMemo(() => data?.versions.filter((item) => item.agent_id === agentId) ?? [], [data?.versions, agentId]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const version = versions.find((item) => item.id === selectedVersionId) ?? workingVersion(versions);

    const [form, setForm] = useState<AgentForm>(emptyAgentForm);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<TestMessage[]>([]);
    const [input, setInput] = useState("");
    const [focusRequest, setFocusRequest] = useState(0);
    const hydratedRef = useRef<string | null>(null);

    const savedForm = useCallback((): AgentForm => ({
        name: agent?.name ?? "",
        description: agent?.description ?? "",
        model: version?.config_json.model ?? "",
        instructions: version?.config_json.instructions ?? version?.config_json.system_prompt ?? "",
    }), [agent, version]);

    // Load the form from the version being edited; only when that changes, so
    // a background refetch never overwrites what the user is typing.
    useEffect(() => {
        if (!agent) return;
        const key = `${agent.id}:${version?.id ?? "none"}`;
        if (hydratedRef.current === key) return;
        hydratedRef.current = key;
        setForm(savedForm());
        setDirty(false);
        setMessages([]);
        setInput("");
    }, [agent, version, savedForm]);

    // Leaving the page with unsaved edits asks first (Copilot too).
    useUnsavedChanges(dirty);
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

    const updateForm = useCallback((field: keyof AgentForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setDirty(true);
        setError(null);
    }, []);

    const act = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
        setBusy(action);
        setError(null);
        try {
            const result = await postStudioAction(projectId, action, payload);
            const agentId = typeof payload.agent_id === "string" ? payload.agent_id : null;
            // A saved draft renames the agent too: show both without waiting for a reload.
            applyStudioResult(queryClient, projectId, result, action === "save_draft" && agentId
                ? { id: agentId, name: String(payload.name ?? ""), description: (payload.description as string) || null }
                : undefined);
            return result;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            return null;
        } finally {
            setBusy(null);
        }
    }, [projectId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

    const saveDraft = useCallback(async () => {
        if (!agent || !version) return false;
        const result = await act("save_draft", { agent_id: agent.id, version_id: version.id, ...form });
        if (result) {
            setDirty(false);
            toast.success("Changes saved");
            return true;
        }
        return false;
    }, [act, agent, form, version]);

    const run = useCallback(async (message?: string) => {
        if (!agent || !version) return;
        const text = (message ?? input).trim();
        if (!text || busy) return;
        // Tests run against the saved draft, so save edits first: what the user
        // sees is what gets tested.
        if (dirty) {
            const saved = await saveDraft();
            if (!saved) return;
        }
        // Earlier turns go with the message, so the test is a conversation.
        // Only what came after the agent last ended the conversation.
        const lastEnded = messages.map((message) => !!message.ended).lastIndexOf(true);
        const history = messages.slice(lastEnded + 1).filter((message) => !message.error && message.content.trim()).map(({ role, content, tools }) => ({ role, content, ...(tools?.length ? { tools: tools.map((tool) => tool.name) } : {}) }));
        setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: text }]);
        setInput("");
        setBusy("test_version");
        const startedAt = Date.now();
        const replyId = `assistant-${startedAt}`;
        let reply = "";
        try {
            // The reply streams in as it's written: delta events, then done or error.
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "test_version", agent_id: agent.id, version_id: version.id, input: text, history, stream: true }),
            });
            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => ({})) as { error?: unknown };
                throw new Error(typeof body.error === "string" ? body.error : "That didn't work. Try again.");
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let failure: string | null = null;
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let boundary: number;
                while ((boundary = buffer.indexOf("\n\n")) !== -1) {
                    const frame = buffer.slice(0, boundary);
                    buffer = buffer.slice(boundary + 2);
                    const event = /^event: (.+)$/m.exec(frame)?.[1];
                    const data = JSON.parse(/^data: (.*)$/m.exec(frame)?.[1] ?? "{}") as { delta?: string; message?: string; conversation_ended?: boolean } & Partial<ToolActivity>;
                    // The reply is created by its first words or its first tool call, whichever comes first.
                    const upsertReply = (change: (message: TestMessage) => TestMessage) => setMessages((current) => current.some((message) => message.id === replyId)
                        ? current.map((message) => message.id === replyId ? change(message) : message)
                        : [...current, change({ id: replyId, role: "assistant", content: "", startedAt })]);
                    if (event === "delta" && data.delta) {
                        reply += data.delta;
                        const content = reply;
                        const delta = data.delta;
                        upsertReply((message) => {
                            const steps = message.steps ?? [];
                            const tail = steps[steps.length - 1];
                            return {
                                ...message,
                                content,
                                steps: tail?.type === "text"
                                    ? [...steps.slice(0, -1), { type: "text", text: tail.text + delta }]
                                    : [...steps, { type: "text", text: delta }],
                            };
                        });
                    } else if (event === "tool" && data.id && data.name && data.status) {
                        const activity: ToolActivity = { id: data.id, name: data.name, status: data.status };
                        upsertReply((message) => {
                            const known = message.tools?.some((tool) => tool.id === activity.id);
                            return {
                                ...message,
                                tools: known
                                    ? message.tools!.map((tool) => tool.id === activity.id ? activity : tool)
                                    : [...(message.tools ?? []), activity],
                                steps: known ? message.steps : [...(message.steps ?? []), { type: "tool", id: activity.id }],
                            };
                        });
                    } else if (event === "done" && data.conversation_ended) {
                        upsertReply((message) => ({ ...message, ended: true }));
                    } else if (event === "error") {
                        failure = data.message ?? "That didn't work. Try again.";
                    }
                }
            }
            if (failure) throw new Error(failure);
            if (!reply.trim()) throw new Error("The model returned no response. Try again.");
        } catch (cause) {
            const content = cause instanceof Error ? cause.message : "That didn't work. Try again.";
            setMessages((current) => [...current, { id: `assistant-error-${Date.now()}`, role: "assistant", content, error: true }]);
        } finally {
            // The turn is over: stamp how long it took, and a call the stream never
            // settled didn't finish, so it can't keep shimmering as if it might.
            setMessages((current) => current.map((message) => message.id === replyId ? {
                ...message,
                durationMs: Date.now() - startedAt,
                tools: message.tools?.map((tool) => tool.status === "running" ? { ...tool, status: "failed" } : tool),
            } : message));
            setBusy(null);
            void queryClient.invalidateQueries({ queryKey });
        }
    }, [agent, busy, dirty, input, messages, projectId, queryClient, saveDraft, version]); // eslint-disable-line react-hooks/exhaustive-deps

    // Publishing needs a saved draft with a passing test, so Publish does both
    // first: save any edits, run one quick test if this draft hasn't passed
    // since its last save, then publish. A failing test stops it and says why.
    const publish = useCallback(async (releaseNotes?: string) => {
        if (!agent || !version || busy) return false;
        setBusy("publish_version");
        setError(null);
        try {
            if (dirty) {
                await postStudioAction(projectId, "save_draft", { agent_id: agent.id, version_id: version.id, ...form });
                setDirty(false);
            }
            if (dirty || !version.last_test_passed) {
                try {
                    await postStudioAction(projectId, "test_version", { agent_id: agent.id, version_id: version.id, input: "Introduce yourself in one sentence." });
                } catch (cause) {
                    throw new Error(`The pre-publish test failed: ${cause instanceof Error ? cause.message : "try again"}`);
                }
            }
            await postStudioAction(projectId, "publish_version", { agent_id: agent.id, version_id: version.id, release_notes: releaseNotes?.trim() || undefined });
            toast.success(`Version ${version.version} published`);
            return true;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            return false;
        } finally {
            setBusy(null);
            void queryClient.invalidateQueries({ queryKey });
        }
    }, [agent, busy, dirty, form, projectId, queryClient, version]); // eslint-disable-line react-hooks/exhaustive-deps

    const discardChanges = useCallback(() => {
        setForm(savedForm());
        setDirty(false);
        setError(null);
    }, [savedForm]);

    const newVersion = useCallback(async () => {
        if (!agent) return;
        const result = await act("new_version", { agent_id: agent.id });
        if (result) {
            setSelectedVersionId(result.version_id as string);
            toast.success("New draft ready", { description: "The published version remains unchanged." });
        }
    }, [act, agent]);

    const canManage = !!data?.can_manage && !!data?.studio_ready;

    // Visibility belongs to the agent, not one version: the marketplace reads
    // the live version, so set it there and on the draft being edited so the
    // next publish keeps it.
    const setVisibility = useCallback(async (visibility: string) => {
        if (!agent || !version || !canManage) return;
        const live = versions.find((item) => item.id === agent.stable_version_id) ?? null;
        const targets = [...new Set([live?.id, version.id].filter((id): id is string => !!id))];
        for (const versionId of targets) {
            if (!await act("set_visibility", { agent_id: agent.id, version_id: versionId, visibility })) return;
        }
        const label = VISIBILITY_LABELS[visibility] ?? visibility;
        toast.success(`${agent.name} is now ${label.toLowerCase()}`, {
            description: visibility === "public"
                ? (live ? "It's listed in the marketplace." : "It's listed in the marketplace once you publish.")
                : undefined,
        });
    }, [act, agent, canManage, version, versions]);

    if (workspace.isLoading) return <>{fallback({ status: "loading" })}</>;
    if (workspace.isError || !data) {
        return <>{fallback({
            status: "error",
            message: workspace.error instanceof Error ? workspace.error.message : "We couldn't load this project's agents.",
            retry: () => void workspace.refetch(),
        })}</>;
    }
    if (!agent) return <>{fallback({ status: "missing" })}</>;

    const editable = !!version && !isLockedVersion(version);
    const simpleVersion = isSimpleVersion(version);

    const value: AgentWorkspaceValue = {
        projectId,
        data,
        agent,
        versions,
        version,
        selectVersion: setSelectedVersionId,
        canManage,
        editable,
        visualEditable: editable && simpleVersion,
        simpleVersion,
        form,
        dirty,
        updateForm,
        busy,
        error,
        setError,
        act,
        saveDraft,
        publish,
        discardChanges,
        publishedVersion: versions.find((item) => item.id === agent.stable_version_id) ?? null,
        newVersion,
        setVisibility,
        test: {
            messages,
            input,
            setInput,
            run,
            reset: () => { setMessages([]); setInput(""); },
            focusRequest,
            requestFocus: () => setFocusRequest((count) => count + 1),
        },
    };

    return <AgentWorkspaceContext.Provider value={value}>{children}</AgentWorkspaceContext.Provider>;
}
