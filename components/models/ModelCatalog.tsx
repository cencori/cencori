"use client";

/**
 * Model Catalog
 * 
 * Searchable, filterable table of all AI models available through Cencori.
 * Uses @lobehub/icons for provider logos.
 */

import { useState, useMemo, useCallback } from "react";
import {
    OpenAI, Anthropic, Google, Mistral, Cohere,
    Perplexity, OpenRouter, Groq, XAI, Together,
    Meta, HuggingFace, Qwen, DeepSeek,
} from "@lobehub/icons";
import { SUPPORTED_PROVIDERS, type AIModel } from "@/lib/providers/config";
import { Search, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
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
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyModelId = useCallback((id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    }, []);

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
        <div className="space-y-5">
            {/* ── Search & Filters ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <input
                        type="text"
                        placeholder="Search models, providers, or types..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 pl-9 pr-4 rounded-xl border border-border/40 bg-card/50 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    />
                </div>

                {/* Filter toggles */}
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* Provider dropdown */}
                    <select
                        value={providerFilter}
                        onChange={(e) => setProviderFilter(e.target.value)}
                        className="flex-1 sm:flex-none h-10 px-3 rounded-xl border border-border/40 bg-card/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer w-full sm:w-auto"
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
                        className="flex-1 sm:flex-none h-10 px-3 rounded-xl border border-border/40 bg-card/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer w-full sm:w-auto"
                    >
                        <option value="all">All Types</option>
                        {types.map((t) => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Result count ── */}
            <div className="flex items-center justify-between text-xs text-muted-foreground/70 px-1">
                <span>{filtered.length} model{filtered.length !== 1 ? "s" : ""}</span>
                <span>{SUPPORTED_PROVIDERS.length} providers</span>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden space-y-2">
                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-border/30 py-12 px-4 text-center text-sm text-muted-foreground/60">
                        No models found matching your filters.
                    </div>
                ) : (
                    filtered.map((model) => (
                        <div
                            key={`${model.providerId}-${model.id}-mobile`}
                            className="rounded-2xl border border-border/30 bg-card/60 p-4 hover:border-border/50 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-muted/40">
                                        <ProviderIcon providerId={model.providerId} size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground truncate leading-tight">{model.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                            <p className="text-[11px] text-muted-foreground/60 font-mono truncate">{model.id}</p>
                                            <button
                                                onClick={() => copyModelId(model.id)}
                                                className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-foreground active:scale-95 transition-all"
                                            >
                                                {copiedId === model.id
                                                    ? <Check className="h-3 w-3 text-emerald-500" />
                                                    : <Copy className="h-3 w-3" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <span
                                    className={cn(
                                        "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                                        TYPE_COLORS[model.type] || "bg-muted text-muted-foreground border-border/20"
                                    )}
                                >
                                    {model.type}
                                </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground/70">
                                <span>{model.providerName}</span>
                                <span className="font-mono text-muted-foreground/50">{formatContext(model.contextWindow)} ctx</span>
                            </div>

                            {model.description && (
                                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/50 line-clamp-2">
                                    {model.description}
                                </p>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* ── Table ── */}
            <div className="hidden md:block border border-border/30 rounded-2xl overflow-hidden bg-card/30">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                        <thead>
                            <tr className="border-b border-border/30">
                                <th
                                    className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 cursor-pointer hover:text-foreground/80 transition-colors select-none w-[30%]"
                                    onClick={() => toggleSort("name")}
                                >
                                    <div className="flex items-center gap-1">
                                        Model <SortIcon column="name" />
                                    </div>
                                </th>
                                <th
                                    className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 cursor-pointer hover:text-foreground/80 transition-colors select-none w-[14%]"
                                    onClick={() => toggleSort("provider")}
                                >
                                    <div className="flex items-center gap-1">
                                        Provider <SortIcon column="provider" />
                                    </div>
                                </th>
                                <th
                                    className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 cursor-pointer hover:text-foreground/80 transition-colors select-none w-[10%]"
                                    onClick={() => toggleSort("type")}
                                >
                                    <div className="flex items-center gap-1">
                                        Type <SortIcon column="type" />
                                    </div>
                                </th>
                                <th
                                    className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 cursor-pointer hover:text-foreground/80 transition-colors select-none w-[10%]"
                                    onClick={() => toggleSort("contextWindow")}
                                >
                                    <div className="flex items-center gap-1 justify-end">
                                        Context <SortIcon column="contextWindow" />
                                    </div>
                                </th>
                                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[28%]">
                                    Description
                                </th>
                                <th className="text-center px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[8%]">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-muted-foreground/50 text-sm">
                                        No models found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((model) => (
                                    <tr
                                        key={`${model.providerId}-${model.id}`}
                                        className="group hover:bg-muted/15 transition-colors"
                                    >
                                        {/* Model name */}
                                        <td className="px-4 py-3.5 overflow-hidden">
                                            <div className="flex items-center gap-3">
                                                <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-muted/30">
                                                    <ProviderIcon providerId={model.providerId} size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-foreground truncate leading-tight">{model.name}</div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                                        <span className="text-[11px] text-muted-foreground/50 font-mono truncate">{model.id}</span>
                                                        <button
                                                            onClick={() => copyModelId(model.id)}
                                                            className={cn(
                                                                "shrink-0 p-0.5 rounded transition-all",
                                                                copiedId === model.id
                                                                    ? "opacity-100 text-emerald-500"
                                                                    : "opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground"
                                                            )}
                                                        >
                                                            {copiedId === model.id
                                                                ? <Check className="h-3 w-3" />
                                                                : <Copy className="h-3 w-3" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Provider */}
                                        <td className="px-4 py-3.5 text-muted-foreground/70 text-[13px]">
                                            {model.providerName}
                                        </td>

                                        {/* Type badge */}
                                        <td className="px-4 py-3.5">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center text-[10px] font-medium px-2.5 py-0.5 rounded-full border",
                                                    TYPE_COLORS[model.type] || "bg-muted text-muted-foreground border-border/20"
                                                )}
                                            >
                                                {model.type}
                                            </span>
                                        </td>

                                        {/* Context */}
                                        <td className="px-4 py-3.5 text-right font-mono text-[12px] text-muted-foreground/50">
                                            {formatContext(model.contextWindow)}
                                        </td>

                                        {/* Description */}
                                        <td className="px-4 py-3.5 text-muted-foreground/50 text-xs truncate">
                                            {model.description || "—"}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500/80 bg-emerald-500/8 px-2 py-0.5 rounded-full">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                                                Live
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
