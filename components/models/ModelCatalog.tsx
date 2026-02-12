"use client";

/**
 * Model Catalog
 * 
 * Searchable, filterable table of all AI models available through Cencori.
 * Uses @lobehub/icons for provider logos.
 */

import { useState, useMemo } from "react";
import {
    OpenAI, Anthropic, Google, Mistral, Cohere,
    Perplexity, OpenRouter, Groq, XAI, Together,
    Meta, HuggingFace, Qwen, DeepSeek,
} from "@lobehub/icons";
import { SUPPORTED_PROVIDERS, type AIProviderConfig, type AIModel } from "@/lib/providers/config";
import { Search, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Provider icon mapping ──────────────────────────────────────────────────

const PROVIDER_ICONS: Record<string, (size: number) => React.ReactNode> = {
    openai: (s) => <OpenAI size={s} />,
    anthropic: (s) => <Anthropic size={s} />,
    google: (s) => <Google.Color size={s} />,
    mistral: (s) => <Mistral.Color size={s} />,
    cohere: (s) => <Cohere.Color size={s} />,
    perplexity: (s) => <Perplexity.Color size={s} />,
    groq: (s) => <Groq size={s} />,
    together: (s) => <Together.Color size={s} />,
    openrouter: (s) => <OpenRouter size={s} />,
    xai: (s) => <XAI size={s} />,
    meta: (s) => <Meta.Color size={s} />,
    huggingface: (s) => <HuggingFace.Color size={s} />,
    qwen: (s) => <Qwen.Color size={s} />,
    deepseek: (s) => <DeepSeek.Color size={s} />,
};

function ProviderIcon({ providerId, size = 16 }: { providerId: string; size?: number }) {
    const render = PROVIDER_ICONS[providerId];
    if (!render) return null;
    return <>{render(size)}</>;
}

// ─── Type badge colors ──────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
    chat: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    reasoning: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    code: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    search: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    embedding: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    image: "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatContext(tokens: number): string {
    if (tokens === 0) return "—";
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
    return `${(tokens / 1_000).toFixed(0)}K`;
}

type SortKey = "name" | "contextWindow" | "provider" | "type";
type SortDir = "asc" | "desc";

// ─── Flat model with provider info ──────────────────────────────────────────

interface FlatModel extends AIModel {
    providerId: string;
    providerName: string;
}

function flattenModels(): FlatModel[] {
    const models: FlatModel[] = [];
    for (const provider of SUPPORTED_PROVIDERS) {
        for (const model of provider.models) {
            models.push({
                ...model,
                providerId: provider.id,
                providerName: provider.name,
            });
        }
    }
    return models;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ModelCatalog() {
    const allModels = useMemo(flattenModels, []);

    const [search, setSearch] = useState("");
    const [providerFilter, setProviderFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [sortKey, setSortKey] = useState<SortKey>("provider");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [showFilters, setShowFilters] = useState(false);

    // Unique types
    const types = useMemo(() => {
        const set = new Set(allModels.map((m) => m.type));
        return Array.from(set).sort();
    }, [allModels]);

    // Filter & sort
    const filtered = useMemo(() => {
        let result = allModels;

        // Search
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (m) =>
                    m.name.toLowerCase().includes(q) ||
                    m.id.toLowerCase().includes(q) ||
                    m.providerName.toLowerCase().includes(q) ||
                    m.description?.toLowerCase().includes(q)
            );
        }

        // Provider filter
        if (providerFilter !== "all") {
            result = result.filter((m) => m.providerId === providerFilter);
        }

        // Type filter
        if (typeFilter !== "all") {
            result = result.filter((m) => m.type === typeFilter);
        }

        // Sort
        result = [...result].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "name":
                    cmp = a.name.localeCompare(b.name);
                    break;
                case "contextWindow":
                    cmp = a.contextWindow - b.contextWindow;
                    break;
                case "provider":
                    cmp = a.providerName.localeCompare(b.providerName) || a.name.localeCompare(b.name);
                    break;
                case "type":
                    cmp = a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
                    break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });

        return result;
    }, [allModels, search, providerFilter, typeFilter, sortKey, sortDir]);

    function toggleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }

    function SortIcon({ column }: { column: SortKey }) {
        if (sortKey !== column) return <ChevronDown className="h-3 w-3 text-muted-foreground/30" />;
        return sortDir === "asc"
            ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground" />;
    }

    return (
        <div className="space-y-4">
            {/* ── Search & Filters ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search models..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 rounded-lg border border-border/50 bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors"
                    />
                </div>

                {/* Filter toggles */}
                <div className="flex gap-2">
                    {/* Provider dropdown */}
                    <select
                        value={providerFilter}
                        onChange={(e) => setProviderFilter(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-border/50 bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer"
                    >
                        <option value="all">All Providers</option>
                        {SUPPORTED_PROVIDERS.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Type dropdown */}
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-border/50 bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer"
                    >
                        <option value="all">All Types</option>
                        {types.map((t) => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Result count ── */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{filtered.length} model{filtered.length !== 1 ? "s" : ""}</span>
                <span>{SUPPORTED_PROVIDERS.length} providers</span>
            </div>

            {/* ── Table ── */}
            <div className="border border-border/40 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/40 bg-muted/30">
                                <th
                                    className="text-left px-4 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                                    onClick={() => toggleSort("name")}
                                >
                                    <div className="flex items-center gap-1">
                                        Model <SortIcon column="name" />
                                    </div>
                                </th>
                                <th
                                    className="text-left px-4 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none hidden sm:table-cell"
                                    onClick={() => toggleSort("provider")}
                                >
                                    <div className="flex items-center gap-1">
                                        Provider <SortIcon column="provider" />
                                    </div>
                                </th>
                                <th
                                    className="text-left px-4 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                                    onClick={() => toggleSort("type")}
                                >
                                    <div className="flex items-center gap-1">
                                        Type <SortIcon column="type" />
                                    </div>
                                </th>
                                <th
                                    className="text-right px-4 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none hidden md:table-cell"
                                    onClick={() => toggleSort("contextWindow")}
                                >
                                    <div className="flex items-center gap-1 justify-end">
                                        Context <SortIcon column="contextWindow" />
                                    </div>
                                </th>
                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                                    Description
                                </th>
                                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">
                                    Cencori
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                                        No models found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((model) => (
                                    <tr
                                        key={`${model.providerId}-${model.id}`}
                                        className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                                    >
                                        {/* Model name */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                                                    <ProviderIcon providerId={model.providerId} size={16} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground">{model.name}</div>
                                                    <div className="text-[11px] text-muted-foreground/60 font-mono">{model.id}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Provider */}
                                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                            {model.providerName}
                                        </td>

                                        {/* Type badge */}
                                        <td className="px-4 py-3">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border",
                                                    TYPE_COLORS[model.type] || "bg-muted text-muted-foreground border-border/20"
                                                )}
                                            >
                                                {model.type}
                                            </span>
                                        </td>

                                        {/* Context */}
                                        <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden md:table-cell">
                                            {formatContext(model.contextWindow)}
                                        </td>

                                        {/* Description */}
                                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate hidden lg:table-cell">
                                            {model.description || "—"}
                                        </td>

                                        {/* Cencori support */}
                                        <td className="px-4 py-3 text-center hidden xl:table-cell">
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px]">
                                                ✓
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
