"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Folder02Icon from "@hugeicons/core-free-icons/Folder02Icon";
import File02Icon from "@hugeicons/core-free-icons/File02Icon";
import Pdf01Icon from "@hugeicons/core-free-icons/Pdf01Icon";
import Doc01Icon from "@hugeicons/core-free-icons/Doc01Icon";
import TextIcon from "@hugeicons/core-free-icons/TextIcon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import FileAddIcon from "@hugeicons/core-free-icons/FileAddIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import FolderSyncIcon from "@hugeicons/core-free-icons/FolderSyncIcon";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { cn } from "@/lib/utils";

const HEAD_CLASS = "h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground";
const ACCEPT = ".pdf,.docx,.md,.markdown,.txt,.html,.htm";
const FILE_TYPES = ["pdf", "docx", "txt", "html", "md"];
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SEARCH_CLASS = "flex h-7 items-center gap-2 rounded-md bg-[#f3f3f1] px-2 text-muted-foreground dark:bg-[#181818]";
const inputClass = "w-full rounded-md bg-[#f3f3f1] px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:bg-[#ececea] dark:bg-[#181818] dark:focus:bg-[#1f1f1f] disabled:opacity-60";

type Source = { id: string; name: string; type: string; url: string | null; auto_refresh: boolean; import_kind: string | null; mime: string | null; bytes: number | null; status: string; error: string | null; created_at: string; updated_at: string };
type KnowledgePayload = { ready: boolean; message?: string; can_manage?: boolean; sources: Source[] };
type AddMode = "url" | "file" | "text";
type UrlKind = "single" | "sitemap" | "website";
const PENDING = new Set(["queued", "processing"]);
type SearchResult = { id: string; source_id: string; source_name: string; page: number | null; score: number; content: string };

async function readJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
    if (!response.ok) throw new Error(body?.error ?? "That didn't work. Try again.");
    return body as T;
}

function formatBytes(bytes: number | null) {
    if (bytes == null) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function kindOf(source: Source) {
    if (source.type === "inline") return { label: "Text", icon: TextIcon };
    if (source.type === "url") return { label: "Web page", icon: Globe02Icon };
    if (source.mime === "application/pdf") return { label: "PDF", icon: Pdf01Icon };
    if (source.mime?.includes("wordprocessingml")) return { label: "Word", icon: Doc01Icon };
    if (source.mime === "text/markdown") return { label: "Markdown", icon: File02Icon };
    if (source.mime === "text/html") return { label: "HTML", icon: File02Icon };
    return { label: "Text file", icon: File02Icon };
}

function SourceStatus({ source }: { source: Source }) {
    const tone = source.status === "ready"
        ? { label: "Ready", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" }
        : source.status === "failed"
            ? { label: "Failed", text: "text-destructive", dot: "bg-destructive" }
            : source.status === "stale"
                ? { label: "Held for review", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" }
                : source.status === "queued"
                    ? { label: "Queued", text: "text-muted-foreground", dot: "bg-muted-foreground" }
                    : { label: "Processing", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
    return (
        <span className={cn("inline-flex items-center gap-1.5 text-xs", tone.text)} title={source.error ?? undefined}>
            <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
            {tone.label}
        </span>
    );
}

/** The agent's documents: what it knows for every customer, live as soon as they're added. */
export function AgentKnowledge() {
    const { projectId, agent } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const queryKey = ["agent-knowledge", projectId, agent.id];
    const endpoint = `/api/projects/${projectId}/embedded-agents/${agent.id}/knowledge`;
    const [filter, setFilter] = useState("");
    const [adding, setAdding] = useState<AddMode | null>(null);
    const [testing, setTesting] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const knowledge = useQuery({
        queryKey,
        queryFn: async () => readJson<KnowledgePayload>(await fetch(endpoint, { cache: "no-store" })),
        // Imports read pages in the background; keep the table current while they do.
        refetchInterval: (query) => (query.state.data?.sources ?? []).some((source) => PENDING.has(source.status)) ? 3000 : false,
    });
    const pending = (knowledge.data?.sources ?? []).filter((source) => PENDING.has(source.status)).length;

    // While pages are waiting, keep asking the server to read them, one call at a time.
    useEffect(() => {
        if (pending === 0) return;
        let stopped = false;
        void (async () => {
            while (!stopped) {
                const result = await fetch(`${endpoint}/process`, { method: "POST" }).then((response) => response.ok ? response.json() as Promise<{ remaining: number }> : null).catch(() => null);
                if (stopped || !result || result.remaining === 0) break;
            }
            if (!stopped) void queryClient.invalidateQueries({ queryKey: ["agent-knowledge", projectId, agent.id] });
        })();
        return () => { stopped = true; };
    }, [pending > 0, endpoint]); // eslint-disable-line react-hooks/exhaustive-deps
    const remove = useMutation({
        mutationFn: async (sourceId: string) => readJson(await fetch(`${endpoint}?source_id=${encodeURIComponent(sourceId)}`, { method: "DELETE" })),
        onSuccess: () => { toast.success("Document removed"); void queryClient.invalidateQueries({ queryKey }); },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove the document."),
        onSettled: () => setConfirmId(null),
    });

    const sync = useMutation({
        mutationFn: async () => readJson<{ updated: number; unchanged: number; failed: number }>(await fetch(`${endpoint}/sync`, { method: "POST" })),
        onSuccess: (result) => {
            const parts = [result.updated && `${result.updated} updated`, result.unchanged && `${result.unchanged} unchanged`, result.failed && `${result.failed} couldn't be read`].filter(Boolean);
            toast.success("Web pages synced", { description: parts.join(" · ") || undefined });
            void queryClient.invalidateQueries({ queryKey });
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not sync web pages."),
    });

    const sources = useMemo(() => {
        const term = filter.trim().toLowerCase();
        return (knowledge.data?.sources ?? []).filter((source) => !term || source.name.toLowerCase().includes(term));
    }, [knowledge.data, filter]);
    const all = knowledge.data?.sources ?? [];
    const canManage = !!knowledge.data?.can_manage;
    const hasWebPages = all.some((source) => source.type === "url");
    const addMenu = (trigger: React.ReactNode) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setAdding("url")} className="gap-2.5 text-sm"><HugeiconsIcon icon={Globe02Icon} className="h-4 w-4" />Add URL</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAdding("file")} className="gap-2.5 text-sm"><HugeiconsIcon icon={File02Icon} className="h-4 w-4" />Add files</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAdding("text")} className="gap-2.5 text-sm"><HugeiconsIcon icon={TextIcon} className="h-4 w-4" />Create text</DropdownMenuItem>
                {hasWebPages && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => sync.mutate()} disabled={sync.isPending} className="gap-2.5 text-sm">
                            <HugeiconsIcon icon={sync.isPending ? Loading03Icon : FolderSyncIcon} className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
                            Sync web pages
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div>
            <header className="mb-6 flex items-center justify-between gap-4">
                <h1 className="text-base font-medium">Knowledge</h1>
                {knowledge.data?.ready && (
                    <div className="flex items-center gap-2">
                        {all.length > 0 && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setTesting(true)}>Test retrieval</Button>}
                        {canManage && addMenu(
                            <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={sync.isPending}>
                                {sync.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                {sync.isPending ? "Syncing…" : "Add document"}
                            </Button>,
                        )}
                    </div>
                )}
            </header>

            {pending > 0 && (
                <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />
                    Reading {pending} {pending === 1 ? "page" : "pages"}… They appear as they&apos;re ready, and keep going if you leave.
                </p>
            )}
            {knowledge.isLoading ? (
                <div className="flex justify-center py-16"><HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin text-muted-foreground" /></div>
            ) : knowledge.error ? (
                <p className="py-16 text-center text-xs text-destructive">{knowledge.error instanceof Error ? knowledge.error.message : "Could not load knowledge."}</p>
            ) : !knowledge.data?.ready ? (
                <p className="rounded-md border border-amber-500/25 px-4 py-3 text-xs leading-5 text-amber-500">{knowledge.data?.message}</p>
            ) : all.length === 0 ? (
                <div className="flex flex-col items-center rounded-lg border border-border/40 bg-muted/30 px-6 py-14 text-center">
                    <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-border/50 bg-background">
                        <HugeiconsIcon icon={Folder02Icon} className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <p className="text-sm font-medium">No documents yet</p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Add web pages, help articles, policies or product docs. The agent looks things up here for every customer.</p>
                    {canManage && <div className="mt-5">{addMenu(<Button size="sm" className="h-7 text-xs">Add document</Button>)}</div>}
                </div>
            ) : (
                <>
                    <label className={cn(SEARCH_CLASS, "mb-4 w-full")}>
                        <Search className="h-4 w-4 shrink-0" />
                        <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search documents" aria-label="Search documents" className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                    </label>
                    <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b border-border/40 hover:bg-transparent">
                                        <TableHead className={cn(HEAD_CLASS, "px-3")}>Name</TableHead>
                                        <TableHead className={cn(HEAD_CLASS, "w-[110px]")}>Type</TableHead>
                                        <TableHead className={cn(HEAD_CLASS, "w-[90px] text-right")}>Size</TableHead>
                                        <TableHead className={cn(HEAD_CLASS, "w-[150px] pl-6")}>Status</TableHead>
                                        <TableHead className={cn(HEAD_CLASS, "w-[120px]")}>Added</TableHead>
                                        <TableHead className={cn(HEAD_CLASS, "w-[90px] pr-3")} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sources.map((source) => {
                                        const kind = kindOf(source);
                                        return (
                                            <TableRow key={source.id} className="group border-b border-border/40 last:border-b-0 hover:bg-muted/50">
                                                <TableCell className="max-w-0 px-3 py-2.5">
                                                    <span className="flex items-center gap-2.5">
                                                        <HugeiconsIcon icon={kind.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-xs font-medium">{source.name}</span>
                                                            {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-muted-foreground hover:text-foreground hover:underline">{source.url.replace(/^https?:\/\//, "")}</a>}
                                                        </span>
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2.5 text-xs text-muted-foreground">{kind.label}</TableCell>
                                                <TableCell className="py-2.5 text-right font-mono text-xs text-muted-foreground">{formatBytes(source.bytes)}</TableCell>
                                                <TableCell className="py-2.5 pl-6"><SourceStatus source={source} /></TableCell>
                                                <TableCell className="whitespace-nowrap py-2.5 text-xs text-muted-foreground">{new Date(source.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</TableCell>
                                                <TableCell className="py-2.5 pr-3 text-right">
                                                    {canManage && (confirmId === source.id ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <Button size="sm" className="h-6 bg-red-600 px-2 text-[11px] text-white hover:bg-red-600/90" onClick={() => remove.mutate(source.id)} disabled={remove.isPending}>
                                                                {remove.isPending ? <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" /> : "Remove"}
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setConfirmId(null)} disabled={remove.isPending}>Cancel</Button>
                                                        </span>
                                                    ) : (
                                                        <Button variant="ghost" size="icon" aria-label={`Remove ${source.name}`} title="Remove" className="h-6 w-6 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100" onClick={() => setConfirmId(source.id)}>
                                                            <HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" />
                                                        </Button>
                                                    ))}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {sources.length === 0 && (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No documents match &ldquo;{filter.trim()}&rdquo;.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </>
            )}

            <AddDocumentDialog mode={adding} onClose={() => setAdding(null)} endpoint={endpoint} onAdded={() => void queryClient.invalidateQueries({ queryKey })} />
            <TestRetrievalDialog open={testing} onOpenChange={setTesting} endpoint={`${endpoint}/search`} />
        </div>
    );
}

const DIALOG_COPY: Record<AddMode, { title: string; description: string }> = {
    url: { title: "Add URL", description: "One page, every page in a sitemap, or a whole website." },
    file: { title: "Add files", description: "Live for every customer as soon as they're added." },
    text: { title: "Create text", description: "Live for every customer as soon as it's added." },
};

function AddDocumentDialog({ mode, onClose, endpoint, onAdded }: { mode: AddMode | null; onClose: () => void; endpoint: string; onAdded: () => void }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [name, setName] = useState("");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [picked, setPicked] = useState<File[]>([]);

    // Too-big or unsupported files are refused here, before anything uploads.
    const addFiles = (files: File[]) => {
        const refused: string[] = [];
        const ok = files.filter((file) => {
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
            if (!ACCEPT.split(",").includes(`.${extension}`)) { refused.push(`${file.name}: unsupported file type`); return false; }
            if (file.size > MAX_FILE_BYTES) { refused.push(`${file.name}: larger than 8 MB`); return false; }
            return true;
        });
        setPicked((current) => [...current, ...ok.filter((file) => !current.some((existing) => existing.name === file.name && existing.size === file.size))]);
        setError(refused.length ? refused.join("\n") : null);
    };

    const close = (next: boolean) => {
        if (busy || next) return;
        onClose();
        setName(""); setText(""); setError(null); setPicked([]);
    };

    // One at a time, so each file's success or failure is reported on its own.
    const upload = async (files: File[]) => {
        if (files.length === 0) return;
        setError(null);
        let added = 0;
        const failures: string[] = [];
        for (const file of files) {
            setBusy(files.length > 1 ? `Adding ${file.name}…` : "Adding…");
            const form = new FormData();
            form.append("file", file);
            try {
                const { source } = await readJson<{ source: Source }>(await fetch(endpoint, { method: "POST", body: form }));
                if (source.status === "ready") added++;
                else failures.push(`${file.name}: ${source.error ?? "couldn't be processed"}`);
            } catch (cause) {
                failures.push(`${file.name}: ${cause instanceof Error ? cause.message : "upload failed"}`);
            }
        }
        setBusy(null);
        onAdded();
        setPicked([]);
        if (added) toast.success(added === 1 ? "Document added" : `${added} documents added`);
        if (failures.length) setError(failures.join("\n"));
        else close(false);
    };

    const addOne = async (payload: { name: string; text: string }) => {
        setBusy("Adding…");
        setError(null);
        try {
            const { source } = await readJson<{ source: Source }>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
            onAdded();
            if (source.status !== "ready") {
                setError(source.error ?? "That couldn't be processed.");
                setBusy(null);
                return;
            }
            toast.success("Document added");
            setBusy(null);
            close(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not add that.");
            setBusy(null);
        }
    };

    return (
        <Dialog open={mode !== null} onOpenChange={close}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-medium">{mode ? DIALOG_COPY[mode].title : ""}</DialogTitle>
                    <DialogDescription className="text-xs">{mode ? DIALOG_COPY[mode].description : ""}</DialogDescription>
                </DialogHeader>

                {mode === "url" ? (
                    <AddUrlForm endpoint={endpoint} busy={busy} setBusy={setBusy} setError={setError} onAdded={onAdded} onDone={() => close(false)} />
                ) : mode === "file" ? (
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
                            disabled={!!busy}
                            className={cn("flex w-full flex-col items-center rounded-lg border px-6 py-8 text-center transition-colors", dragging ? "border-foreground/30 bg-muted/60" : "border-border/50 hover:bg-muted/30")}
                        >
                            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border/50 bg-background">
                                <HugeiconsIcon icon={FileAddIcon} className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <span className="text-sm font-medium">Click or drag files to upload</span>
                            <span className="mt-0.5 text-xs text-muted-foreground">Up to 8 MB each.</span>
                            <span className="mt-3 flex flex-wrap justify-center gap-1.5">
                                {FILE_TYPES.map((type) => <span key={type} className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{type}</span>)}
                            </span>
                            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; addFiles(files); }} />
                        </button>
                        {picked.length > 0 && (
                            <ul className="space-y-1.5">
                                {picked.map((file, index) => (
                                    <li key={`${file.name}-${index}`} className="flex items-center gap-2.5 rounded-md bg-muted/40 px-3 py-2 text-xs">
                                        <HugeiconsIcon icon={File02Icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
                                        <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setPicked((current) => current.filter((_, at) => at !== index))} disabled={!!busy} className="shrink-0 text-muted-foreground hover:text-foreground">
                                            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => close(false)} disabled={!!busy}>Cancel</Button>
                            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void upload(picked)} disabled={picked.length === 0 || !!busy}>
                                {busy && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                {busy ?? (picked.length > 1 ? `Add ${picked.length} files` : "Add file")}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Name, e.g. Refund policy" autoFocus className={inputClass} disabled={!!busy} />
                        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the text your agent should know…" rows={9} className={cn(inputClass, "resize-y leading-6")} disabled={!!busy} />
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => close(false)} disabled={!!busy}>Cancel</Button>
                            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void addOne({ name, text })} disabled={!text.trim() || !!busy}>
                                {busy && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                Add text
                            </Button>
                        </div>
                    </div>
                )}
                {error && <p role="alert" className="whitespace-pre-line text-xs leading-5 text-destructive">{error}</p>}
            </DialogContent>
        </Dialog>
    );
}

function TestRetrievalDialog({ open, onOpenChange, endpoint }: { open: boolean; onOpenChange: (open: boolean) => void; endpoint: string }) {
    const [query, setQuery] = useState("");
    const search = useMutation({
        mutationFn: async (q: string) => (await readJson<{ results: SearchResult[] }>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) }))).results,
    });

    return (
        <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setQuery(""); search.reset(); } }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-medium">Test retrieval</DialogTitle>
                    <DialogDescription className="text-xs">Ask what a customer might. These are the passages the agent would be given.</DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => { event.preventDefault(); if (query.trim()) search.mutate(query.trim()); }} className="flex gap-2">
                    <label className={cn(SEARCH_CLASS, "flex-1")}>
                        <Search className="h-4 w-4 shrink-0" />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. How do refunds work?" autoFocus className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                    </label>
                    <Button type="submit" size="sm" className="h-7 gap-1.5 text-xs" disabled={!query.trim() || search.isPending}>
                        {search.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                        Search
                    </Button>
                </form>
                {search.error && <p role="alert" className="text-xs text-destructive">{search.error instanceof Error ? search.error.message : "Search failed."}</p>}
                {search.data && (search.data.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">Nothing relevant found. The agent would answer from its instructions alone.</p>
                ) : (
                    <ol className="space-y-3">
                        {search.data.map((result, index) => (
                            <li key={result.id} className="rounded-lg border border-border/40 bg-muted/30 p-3">
                                <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                                    <span className="truncate"><span className="font-mono">[{index + 1}]</span> {result.source_name}{result.page ? ` · page ${result.page}` : ""}</span>
                                    <span className="shrink-0 font-mono">{Math.round(result.score * 100)}% match</span>
                                </div>
                                <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-5">{result.content}</p>
                            </li>
                        ))}
                    </ol>
                ))}
            </DialogContent>
        </Dialog>
    );
}

const URL_KINDS: Array<{ value: UrlKind; label: string }> = [
    { value: "single", label: "Single URL" },
    { value: "sitemap", label: "Sitemap" },
    { value: "website", label: "Whole website" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-xs font-medium">{label}</span>
            {hint && <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{hint}</span>}
            <span className="mt-1.5 block">{children}</span>
        </label>
    );
}

/** One page now, or a sitemap/website queued and read in the background. */
function AddUrlForm({ endpoint, busy, setBusy, setError, onAdded, onDone }: {
    endpoint: string;
    busy: string | null;
    setBusy: (value: string | null) => void;
    setError: (value: string | null) => void;
    onAdded: () => void;
    onDone: () => void;
}) {
    const [kind, setKind] = useState<UrlKind>("single");
    const [url, setUrl] = useState("");
    const [pattern, setPattern] = useState("");
    const [maxPages, setMaxPages] = useState("100");
    const [exclude, setExclude] = useState<string[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const submit = async () => {
        setBusy(kind === "single" ? "Reading the page…" : kind === "sitemap" ? "Reading the sitemap…" : "Reading pages…");
        setError(null);
        try {
            const payload = { url: url.trim(), kind, pattern: pattern.trim() || undefined, exclude: exclude.filter((item) => item.trim()), max_pages: Number(maxPages) || undefined, auto_refresh: autoRefresh };
            const result = await readJson<{ source?: Source; queued?: number; processed?: number; remaining?: number }>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
            onAdded();
            setBusy(null);
            if (result.source) {
                if (result.source.status !== "ready") { setError(result.source.error ?? "That page couldn't be processed."); return; }
                toast.success("Page added");
            } else {
                const waiting = result.remaining ?? 0;
                toast.success(kind === "website" ? "Reading the website" : `Found ${result.queued} ${result.queued === 1 ? "page" : "pages"}`, {
                    description: waiting ? "Pages appear as they're read. You can leave this page." : undefined,
                });
            }
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not add that.");
            setBusy(null);
        }
    };

    return (
        <form onSubmit={(event) => { event.preventDefault(); if (url.trim()) void submit(); }} className="space-y-4">
            <div className="grid grid-cols-3 rounded-md bg-muted/60 p-0.5 text-xs">
                {URL_KINDS.map((item) => (
                    <button key={item.value} type="button" onClick={() => setKind(item.value)} disabled={!!busy} className={cn("rounded px-3 py-1.5 transition-colors", kind === item.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {item.label}
                    </button>
                ))}
            </div>

            <Field label="URL" hint={kind === "sitemap" ? "A sitemap, or any page on the site and we'll find its sitemap." : kind === "website" ? "We start here and follow links on the same site." : undefined}>
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={kind === "sitemap" ? "https://example.com/sitemap.xml" : "https://example.com"} type="url" inputMode="url" autoFocus className={inputClass} disabled={!!busy} />
            </Field>

            {kind !== "single" && (
                <>
                    <Field label="Max pages" hint="Up to 500.">
                        <input value={maxPages} onChange={(event) => setMaxPages(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={inputClass} disabled={!!busy} />
                    </Field>
                    <Field label="Pattern" hint={`Only include URLs that match. ${kind === "website" ? "All links are followed" : "All sitemap pages are included"} if left empty.`}>
                        <input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="*/docs/*" className={inputClass} disabled={!!busy} />
                    </Field>
                </>
            )}
            {kind === "website" && (
                <div>
                    <span className="block text-xs font-medium">Exclude</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">Skip URLs that match any of these.</span>
                    <div className="mt-1.5 space-y-2">
                        {exclude.map((item, index) => (
                            <div key={index} className="flex gap-2">
                                <input value={item} onChange={(event) => setExclude((current) => current.map((value, at) => at === index ? event.target.value : value))} placeholder="*/blog/*" className={inputClass} disabled={!!busy} />
                                <Button type="button" variant="ghost" size="icon" aria-label="Remove pattern" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={() => setExclude((current) => current.filter((_, at) => at !== index))} disabled={!!busy}>
                                    <HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                        {exclude.length < 20 && <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setExclude((current) => [...current, ""])} disabled={!!busy}>+ Add</Button>}
                    </div>
                </div>
            )}

            <label className="flex items-start gap-3">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} disabled={!!busy} className="mt-0.5" />
                <span>
                    <span className="block text-xs font-medium">Auto refresh</span>
                    <span className="block text-[11px] leading-4 text-muted-foreground">Re-read {kind === "single" ? "the page" : "these pages"} once a day and pick up changes.</span>
                </span>
            </label>

            <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onDone} disabled={!!busy}>Cancel</Button>
                <Button type="submit" size="sm" className="h-7 gap-1.5 text-xs" disabled={!url.trim() || !!busy}>
                    {busy && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                    {busy ?? (kind === "single" ? "Add URL" : kind === "sitemap" ? "Add pages" : "Add website")}
                </Button>
            </div>
        </form>
    );
}
