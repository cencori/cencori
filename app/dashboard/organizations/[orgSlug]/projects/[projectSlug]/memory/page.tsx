"use client";

import { useState, use, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { CircleStackIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Search, Trash2, Database, Clock, Hash, Copy, Check, ExternalLink, Layers, Plus, Upload, MessageSquare, Send, Sparkles, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Namespace {
    id: string;
    name: string;
    description?: string;
    memory_count: number;
    created_at: string;
}

interface Memory {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
    similarity?: number;
}

type PageParams = Promise<{ orgSlug: string; projectSlug: string }>;

// Getting Started Section - Shows when no memories exist
function GettingStartedSection({ namespaceName }: { namespaceName?: string }) {
    const [copiedStore, setCopiedStore] = useState(false);
    const [copiedSearch, setCopiedSearch] = useState(false);

    const storeCode = `await cencori.memory.store({
    namespace: "${namespaceName || "my-namespace"}",
    content: "The user prefers dark mode",
    metadata: { type: "preference", user_id: "123" }
});`;

    const searchCode = `const results = await cencori.memory.search({
    namespace: "${namespaceName || "my-namespace"}",
    query: "What are the user's preferences?",
    limit: 5
});`;

    const copyStore = async () => {
        await navigator.clipboard.writeText(storeCode);
        setCopiedStore(true);
        setTimeout(() => setCopiedStore(false), 2000);
    };

    const copySearch = async () => {
        await navigator.clipboard.writeText(searchCode);
        setCopiedSearch(true);
        setTimeout(() => setCopiedSearch(false), 2000);
    };

    return (
        <div className="space-y-4 max-w-2xl">
            <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Getting started</span>
                </div>
                <h3 className="text-base font-medium">Store and search memories</h3>
                <p className="text-xs text-muted-foreground">
                    Use the SDK to store data with automatic vector embeddings.
                </p>
            </div>

            <div className="grid gap-2">
                {/* Store Memory */}
                <div className="border border-border/40 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-medium">1</span>
                            <span className="text-xs font-medium">Store a memory</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyStore}>
                            {copiedStore ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                        </Button>
                    </div>
                    <div className="px-3 py-2 bg-zinc-950">
                        <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap">{storeCode}</pre>
                    </div>
                </div>

                {/* Search Memory */}
                <div className="border border-border/40 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-medium">2</span>
                            <span className="text-xs font-medium">Search semantically</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copySearch}>
                            {copiedSearch ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                        </Button>
                    </div>
                    <div className="px-3 py-2 bg-zinc-950">
                        <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap">{searchCode}</pre>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" asChild>
                    <Link href="https://cencori.com/docs/memory" target="_blank">
                        <ExternalLink className="h-3 w-3" />
                        View Docs
                    </Link>
                </Button>
            </div>
        </div>
    );
}

export default function MemoryPage({ params }: { params: PageParams }) {
    const { orgSlug, projectSlug } = use(params);
    const queryClient = useQueryClient();

    const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [addMemoryDialogOpen, setAddMemoryDialogOpen] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [namespaceToDelete, setNamespaceToDelete] = useState<Namespace | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);
    const [newNamespace, setNewNamespace] = useState({ name: "", description: "" });
    const [newMemory, setNewMemory] = useState({ content: "", metadata: "" });
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [ragDialogOpen, setRagDialogOpen] = useState(false);
    const [ragInput, setRagInput] = useState("");
    const [ragResponse, setRagResponse] = useState<{ response: string; sources: Array<{ content: string; similarity: number }> } | null>(null);
    const [ragLoading, setRagLoading] = useState(false);

    // Track last search query
    useEffect(() => {
        if (searchQuery.trim()) {
            const timer = setTimeout(() => {
                setLastSearchQuery(searchQuery.trim());
            }, 500); // Debounce to wait for typing to finish
            return () => clearTimeout(timer);
        }
    }, [searchQuery]);

    // Fetch project ID using direct Supabase query (like other project pages)
    const { data: projectData } = useQuery({
        queryKey: ["projectMemory", orgSlug, projectSlug],
        queryFn: async () => {
            const { data: orgData, error: orgError } = await supabase
                .from("organizations")
                .select("id")
                .eq("slug", orgSlug)
                .single();

            if (orgError || !orgData) throw new Error("Organization not found");

            const { data: project, error: projectError } = await supabase
                .from("projects")
                .select("id, name, slug")
                .eq("organization_id", orgData.id)
                .eq("slug", projectSlug)
                .single();

            if (projectError || !project) throw new Error("Project not found");
            return project;
        },
        staleTime: 5 * 60 * 1000,
    });

    const projectId = projectData?.id;

    // Fetch namespaces
    const { data: namespaces = [], isLoading: namespacesLoading } = useQuery({
        queryKey: ["memory-namespaces", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/memory/namespaces`);
            if (!res.ok) throw new Error("Failed to fetch namespaces");
            const data = await res.json();
            return data.namespaces || [];
        },
        enabled: !!projectId,
    });

    // Fetch memories for selected namespace
    const { data: memories = [], isLoading: memoriesLoading } = useQuery({
        queryKey: ["memories", projectId, selectedNamespace?.id, searchQuery],
        queryFn: async () => {
            const endpoint = searchQuery
                ? `/api/projects/${projectId}/memory/search?namespace=${selectedNamespace?.name}&query=${encodeURIComponent(searchQuery)}`
                : `/api/projects/${projectId}/memory/memories?namespace=${selectedNamespace?.id}`;
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error("Failed to fetch memories");
            const data = await res.json();
            return data.memories || data.results || [];
        },
        enabled: !!projectId && !!selectedNamespace,
    });

    // Create namespace mutation
    const createNamespaceMutation = useMutation({
        mutationFn: async (data: { name: string; description: string }) => {
            const res = await fetch(`/api/projects/${projectId}/memory/namespaces`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to create namespace");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["memory-namespaces", projectId] });
            setCreateDialogOpen(false);
            setNewNamespace({ name: "", description: "" });
            toast.success("Namespace created");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    // Delete namespace mutation
    const deleteNamespaceMutation = useMutation({
        mutationFn: async (namespaceId: string) => {
            const res = await fetch(`/api/projects/${projectId}/memory/namespaces/${namespaceId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete namespace");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["memory-namespaces", projectId] });
            setSelectedNamespace(null);
            toast.success("Namespace deleted");
        },
    });

    const handleCreateNamespace = () => {
        if (!newNamespace.name.trim()) {
            toast.error("Namespace name is required");
            return;
        }
        createNamespaceMutation.mutate(newNamespace);
    };

    // Store memory mutation
    const storeMemoryMutation = useMutation({
        mutationFn: async (data: { content: string; metadata: string }) => {
            let parsedMetadata = {};
            if (data.metadata.trim()) {
                try {
                    parsedMetadata = JSON.parse(data.metadata);
                } catch {
                    throw new Error("Invalid JSON in metadata");
                }
            }
            const res = await fetch(`/api/projects/${projectId}/memory/memories/store`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    namespace_id: selectedNamespace?.id,
                    content: data.content,
                    metadata: parsedMetadata,
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to store memory");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
            queryClient.invalidateQueries({ queryKey: ["memory-namespaces", projectId] });
            setAddMemoryDialogOpen(false);
            setNewMemory({ content: "", metadata: "" });
            toast.success("Memory stored");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const handleStoreMemory = () => {
        if (!newMemory.content.trim()) {
            toast.error("Content is required");
            return;
        }
        storeMemoryMutation.mutate(newMemory);
    };

    // Upload document mutation
    const uploadDocumentMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("namespace_id", selectedNamespace?.id || "");

            const res = await fetch(`/api/projects/${projectId}/memory/upload`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to upload document");
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
            queryClient.invalidateQueries({ queryKey: ["memory-namespaces", projectId] });
            setUploadDialogOpen(false);
            setUploadFile(null);
            toast.success(data.message || "Document uploaded");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const handleUploadDocument = () => {
        if (!uploadFile) {
            toast.error("Please select a file");
            return;
        }
        uploadDocumentMutation.mutate(uploadFile);
    };

    // RAG - Ask AI with memory context
    const handleRagRequest = async () => {
        if (!ragInput.trim() || !selectedNamespace) return;

        setRagLoading(true);
        setRagResponse(null);

        try {
            const res = await fetch(`/api/projects/${projectId}/memory/rag`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    namespace: selectedNamespace.name,
                    message: ragInput,
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to get response");
            }

            const data = await res.json();
            setRagResponse(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to get AI response");
        } finally {
            setRagLoading(false);
        }
    };

    // Calculate stats
    const totalMemories = namespaces.reduce((acc: number, ns: Namespace) => acc + (ns.memory_count || 0), 0);
    const totalNamespaces = namespaces.length;
    const hasData = totalMemories > 0 || totalNamespaces > 0;

    return (
        <>
            <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">AI Memory</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Store and search data using vector embeddings
                        </p>
                    </div>
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="h-7 text-xs">
                                New Namespace
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Namespace</DialogTitle>
                                <DialogDescription>
                                    Namespaces organize your memories into logical groups.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., conversations, documents"
                                        value={newNamespace.name}
                                        onChange={(e) => setNewNamespace(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (optional)</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="What will this namespace store?"
                                        value={newNamespace.description}
                                        onChange={(e) => setNewNamespace(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreateNamespace} disabled={createNamespaceMutation.isPending}>
                                    {createNamespaceMutation.isPending ? "Creating..." : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Stats Cards - Only show when has data */}
                {hasData && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-border/40 bg-card p-5">
                            <div className="flex items-center gap-2.5 mb-2">
                                <span className="text-sm font-medium">Total Memories</span>
                            </div>
                            <p className="text-3xl font-semibold">{totalMemories.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground mt-1">Stored with vector embeddings</p>
                        </div>

                        <div className="rounded-xl border border-border/40 bg-card p-5">
                            <div className="flex items-center gap-2.5 mb-2">
                                <span className="text-sm font-medium">Namespaces</span>
                            </div>
                            <p className="text-3xl font-semibold">{totalNamespaces}</p>
                            <p className="text-xs text-muted-foreground mt-1">Logical memory groups</p>
                        </div>

                        <div className="rounded-xl border border-border/40 bg-card p-5">
                            <div className="flex items-center gap-2.5 mb-2">
                                <span className="text-sm font-medium">Last Query</span>
                            </div>
                            <p className="text-lg font-semibold truncate">
                                {lastSearchQuery || <span className="text-muted-foreground">No searches yet</span>}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Most recent search</p>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Namespace List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-medium">Namespaces</h2>
                            {namespaces.length > 0 && (
                                <span className="text-xs text-muted-foreground">{namespaces.length} total</span>
                            )}
                        </div>
                        {namespacesLoading ? (
                            <div className="text-sm text-muted-foreground">Loading...</div>
                        ) : namespaces.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="py-8 text-center">
                                    <Database className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                    <p className="text-sm text-muted-foreground">No namespaces yet</p>
                                    <p className="text-xs text-muted-foreground mt-1">Create one to get started</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="border rounded-lg divide-y">
                                {namespaces.map((ns: Namespace) => (
                                    <div
                                        key={ns.id}
                                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-accent/50 ${selectedNamespace?.id === ns.id ? "bg-accent/30" : ""}`}
                                        onClick={() => {
                                            setSelectedNamespace(ns);
                                            setSearchQuery("");
                                        }}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{ns.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {ns.memory_count || 0} memories
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setNamespaceToDelete(ns);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Memory Browser */}
                    <div className="lg:col-span-2 space-y-4">
                        {selectedNamespace ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Semantic search..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Dialog open={addMemoryDialogOpen} onOpenChange={setAddMemoryDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm">
                                                Add Memory
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Add Memory</DialogTitle>
                                                <DialogDescription>
                                                    Store a new memory in "{selectedNamespace.name}"
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Content</Label>
                                                    <Textarea
                                                        placeholder="Enter the content to store..."
                                                        value={newMemory.content}
                                                        onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                                                        rows={4}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Metadata (optional JSON)</Label>
                                                    <Textarea
                                                        placeholder='{"key": "value"}'
                                                        value={newMemory.metadata}
                                                        onChange={(e) => setNewMemory({ ...newMemory, metadata: e.target.value })}
                                                        rows={2}
                                                        className="font-mono text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setAddMemoryDialogOpen(false)}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={handleStoreMemory}
                                                    disabled={storeMemoryMutation.isPending}
                                                >
                                                    {storeMemoryMutation.isPending ? "Storing..." : "Store Memory"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline">
                                                Upload
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Upload Document</DialogTitle>
                                                <DialogDescription>
                                                    Upload a document to automatically chunk and store in "{selectedNamespace.name}"
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>File (TXT, MD, or PDF)</Label>
                                                    <Input
                                                        type="file"
                                                        accept=".txt,.md,.pdf"
                                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                                    />
                                                </div>
                                                {uploadFile && (
                                                    <div className="text-sm text-muted-foreground">
                                                        Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                                                    </div>
                                                )}
                                                <div className="text-xs text-muted-foreground">
                                                    Documents will be automatically split into chunks (~1000 chars each) and stored with embeddings.
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setUploadDialogOpen(false);
                                                        setUploadFile(null);
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={handleUploadDocument}
                                                    disabled={uploadDocumentMutation.isPending || !uploadFile}
                                                >
                                                    {uploadDocumentMutation.isPending ? "Uploading..." : "Upload & Process"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    {/* Ask AI Button */}
                                    <Dialog open={ragDialogOpen} onOpenChange={(open) => {
                                        setRagDialogOpen(open);
                                        if (!open) {
                                            setRagInput("");
                                            setRagResponse(null);
                                        }
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="gap-2">
                                                Ask AI
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[500px]">
                                            <DialogHeader className="pb-2">
                                                <DialogTitle>Ask AI</DialogTitle>
                                                <DialogDescription className="text-xs">
                                                    Using &quot;{selectedNamespace.name}&quot; memories as context
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 rounded-full border bg-background px-2.5 pl-4 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Ask anything"
                                                        value={ragInput}
                                                        onChange={(e) => setRagInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleRagRequest();
                                                            }
                                                        }}
                                                        disabled={ragLoading}
                                                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                                    />
                                                    <button
                                                        onClick={handleRagRequest}
                                                        disabled={ragLoading || !ragInput.trim()}
                                                        className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 disabled:opacity-50"
                                                    >
                                                        <ArrowUp className="h-4 w-4"/>
                                                    </button>
                                                </div>

                                                {ragLoading && (
                                                    <div className="flex items-center justify-center py-4">
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                                            Generating...
                                                        </div>
                                                    </div>
                                                )}

                                                {ragResponse && (
                                                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                                        <div className="rounded-lg bg-muted/50 p-3">
                                                            <p className="text-sm whitespace-pre-wrap">{ragResponse.response}</p>
                                                        </div>
                                                        {ragResponse.sources && ragResponse.sources.length > 0 && (
                                                            <div className="text-xs text-muted-foreground">
                                                                <span className="font-medium">Sources:</span>{" "}
                                                                {ragResponse.sources.length} memories used
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm">
                                                {searchQuery ? `Search results in "${selectedNamespace.name}"` : `Memories in "${selectedNamespace.name}"`}
                                            </CardTitle>
                                            <span className="text-xs text-muted-foreground">
                                                {memories.length} {memories.length === 1 ? "memory" : "memories"}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {memoriesLoading ? (
                                            <div className="text-sm text-muted-foreground py-4">Loading...</div>
                                        ) : memories.length === 0 ? (
                                            <GettingStartedSection namespaceName={selectedNamespace.name} />
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Content</TableHead>
                                                        <TableHead className="w-32">Metadata</TableHead>
                                                        {searchQuery && <TableHead className="w-24">Score</TableHead>}
                                                        <TableHead className="w-32">Created</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {memories.map((memory: Memory) => (
                                                        <TableRow key={memory.id}>
                                                            <TableCell className="max-w-md">
                                                                <p className="text-sm truncate">{memory.content}</p>
                                                            </TableCell>
                                                            <TableCell>
                                                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                                                    {Object.keys(memory.metadata || {}).length} keys
                                                                </code>
                                                            </TableCell>
                                                            {searchQuery && (
                                                                <TableCell>
                                                                    <span className="text-xs font-mono">
                                                                        {((memory.similarity || 0) * 100).toFixed(1)}%
                                                                    </span>
                                                                </TableCell>
                                                            )}
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {formatDistanceToNow(new Date(memory.created_at), { addSuffix: true })}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            /* Empty state with getting started */
                            <div className="space-y-6">
                                {!hasData ? (
                                    <GettingStartedSection />
                                ) : (
                                    <Card className="border-dashed">
                                        <CardContent className="py-16 text-center">
                                            <CircleStackIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                                            <p className="text-muted-foreground">Select a namespace to browse memories</p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Namespace</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{namespaceToDelete?.name}&quot;? This will permanently delete all {namespaceToDelete?.memory_count || 0} memories in this namespace.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteDialogOpen(false);
                                setNamespaceToDelete(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (namespaceToDelete) {
                                    deleteNamespaceMutation.mutate(namespaceToDelete.id);
                                }
                                setDeleteDialogOpen(false);
                                setNamespaceToDelete(null);
                            }}
                            disabled={deleteNamespaceMutation.isPending}
                        >
                            {deleteNamespaceMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
