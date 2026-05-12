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
    Ai21, Bedrock, Nova, Azure, Cerebras,
    Cloudflare, DeepInfra, Fireworks, Nvidia,
    SambaNova, Upstage, Minimax, Moonshot,
    Stepfun, Baseten, Alibaba, Baidu,
} from "@lobehub/icons";
import { SUPPORTED_PROVIDERS, type AIModel } from "@/lib/providers/config";
import { Search, ChevronDown, ChevronUp, Copy, Check, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
 
// ─── Custom Icons ───────────────────────────────────────────────────────────
 
const AmazonIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#f90" d="M108.59 26.148c-1.852 0-3.622.211-5.305.715-1.684.504-3.117 1.223-4.379 2.188a10.829 10.829 0 0 0-3.031 3.453c-.757 1.348-1.137 2.906-1.137 4.676 0 2.187.716 4.25 2.106 6.105 1.386 1.895 3.66 3.324 6.734 4.293l6.106 1.895c2.062.675 3.496 1.391 4.254 2.191.757.801 1.136 1.765 1.136 2.945 0 1.726-.758 3.074-2.191 4-1.43.925-3.492 1.391-6.145 1.391-1.687 0-3.328-.168-5.011-.504a23.102 23.102 0 0 1-4.633-1.476c-.421-.168-.801-.336-1.051-.418a2.357 2.357 0 0 0-.758-.13c-.634 0-.969.423-.969 1.305v2.149a2.919 2.919 0 0 0 .254 1.18c.168.38.629.8 1.305 1.18 1.094.628 2.734 1.179 4.84 1.683 2.105.504 4.297.758 6.484.758 2.15 0 4.129-.297 6.024-.883 1.808-.551 3.367-1.309 4.672-2.36 1.304-1.01 2.316-2.273 3.074-3.707.714-1.429 1.094-3.07 1.094-4.882 0-2.188-.633-4.168-1.938-5.895-1.304-1.727-3.491-3.074-6.523-4.043l-5.98-1.895c-2.23-.713-3.79-1.516-4.634-2.316-.84-.797-1.261-1.808-1.261-2.988 0-1.726.671-2.95 1.98-3.746 1.305-.801 3.199-1.18 5.598-1.18 2.988 0 5.683.547 8.086 1.64.714.337 1.261.508 1.597.508.633 0 .969-.463.969-1.347v-1.98c0-.59-.125-1.051-.379-1.391-.25-.378-.672-.715-1.262-1.051-.422-.254-1.011-.504-1.77-.758a32.528 32.528 0 0 0-2.398-.676c-.886-.168-1.769-.336-2.738-.46a21.347 21.347 0 0 0-2.82-.169zm-86.822.082c-2.316 0-4.508.254-6.57.801-2.063.505-3.831 1.137-5.303 1.895-.59.297-.97.59-1.18.883-.211.296-.293.8-.293 1.476v2.063c0 .882.293 1.304.883 1.304.168 0 .378-.043.674-.125.293-.086.796-.254 1.472-.547a33.416 33.416 0 0 1 4.547-1.433A19.176 19.176 0 0 1 20.547 32c3.242 0 5.513.633 6.863 1.938 1.304 1.303 1.98 3.534 1.98 6.734v3.074c-1.683-.379-3.283-.715-4.843-.926-1.558-.21-3.031-.336-4.461-.336-4.34 0-7.75 1.094-10.316 3.286-2.571 2.187-3.832 5.093-3.832 8.671 0 3.368 1.05 6.063 3.113 8.086 2.066 2.02 4.887 3.032 8.422 3.032 4.97 0 9.097-1.938 12.379-5.813a34.153 34.153 0 0 0 1.304 2.484 13.28 13.28 0 0 0 1.516 1.98c.422.38.844.59 1.266.59.334 0 .714-.128 1.093-.378l2.653-1.77c.546-.42.8-.843.8-1.261a1.86 1.86 0 0 0-.293-.97 22.469 22.469 0 0 1-1.347-3.03c-.297-.925-.465-2.19-.465-3.75h-.086V40c0-4.633-1.176-8.086-3.492-10.36-2.36-2.273-6.025-3.41-11.033-3.41zm19.58 1.012c-.676 0-1.012.379-1.012 1.051 0 .297.129.844.379 1.687l9.894 32.547c.254.8.547 1.387.887 1.641.336.297.84.422 1.598.422h3.62c.759 0 1.347-.125 1.684-.422.34-.293.591-.84.801-1.684l6.485-27.117 6.527 27.16c.168.84.46 1.387.8 1.684.337.292.883.422 1.684.422h3.621c.715 0 1.262-.167 1.598-.422.34-.253.633-.8.887-1.64L90.949 30.02c.168-.46.25-.797.293-1.051.043-.254.086-.466.086-.676 0-.715-.379-1.05-1.055-1.05H86.36c-.757 0-1.308.166-1.644.421-.293.25-.59.8-.84 1.64L76.59 57.517l-6.653-28.211c-.166-.8-.464-1.39-.8-1.64-.336-.298-.884-.423-1.684-.423h-3.367c-.758 0-1.348.167-1.688.422-.335.25-.588.8-.796 1.64l-6.57 27.876-7.075-27.875c-.25-.8-.504-1.39-.84-1.64-.297-.298-.844-.423-1.644-.423h-4.125zM21.64 47.496a31.816 31.816 0 0 1 3.96.25 34.401 34.401 0 0 1 3.872.719v1.765c0 1.435-.168 2.653-.422 3.665-.25 1.01-.758 1.895-1.43 2.695-1.137 1.262-2.484 2.187-4 2.695-1.516.504-2.949.758-4.336.758-1.937 0-3.41-.508-4.422-1.559-1.054-1.01-1.558-2.484-1.558-4.464 0-2.106.675-3.704 2.062-4.84 1.391-1.137 3.454-1.684 6.274-1.684zM118 73.348c-4.432.063-9.664 1.052-13.621 3.832-1.223.883-1.012 2.062.336 1.894 4.508-.547 14.44-1.726 16.21.547 1.77 2.23-1.976 11.62-3.663 15.79-.504 1.26.59 1.769 1.726.8 7.41-6.231 9.348-19.242 7.832-21.137-.757-.925-4.388-1.79-8.82-1.726zM1.63 75.859c-.926.116-1.347 1.236-.368 2.121 16.508 14.902 38.359 23.872 62.613 23.872 17.305 0 37.43-5.43 51.281-15.66 2.273-1.689.298-4.254-2.02-3.204-15.533 6.57-32.421 9.77-47.788 9.77-22.778 0-44.8-6.273-62.653-16.633-.39-.231-.755-.304-1.064-.266z" />
    </svg>
);
 
const AzureIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <defs>
            <linearGradient id="azure-grad-a" x1="60.919" y1="9.602" x2="18.667" y2="134.423" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#114A8B" />
                <stop offset="1" stopColor="#0669BC" />
            </linearGradient>
            <linearGradient id="azure-grad-b" x1="74.117" y1="67.772" x2="64.344" y2="71.076" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopOpacity=".3" />
                <stop offset=".071" stopOpacity=".2" />
                <stop offset=".321" stopOpacity=".1" />
                <stop offset=".623" stopOpacity=".05" />
                <stop offset="1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="azure-grad-c" x1="68.742" y1="5.961" x2="115.122" y2="129.525" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#3CCBF4" />
                <stop offset="1" stopColor="#2892DF" />
            </linearGradient>
        </defs>
        <path d="M46.09.002h40.685L44.541 125.137a6.485 6.485 0 01-6.146 4.413H6.733a6.482 6.482 0 01-5.262-2.699 6.474 6.474 0 01-.876-5.848L39.944 4.414A6.488 6.488 0 0146.09 0z" fill="url(#azure-grad-a)" transform="translate(.587 4.468) scale(.91904)" />
        <path d="M97.28 81.607H37.987a2.743 2.743 0 00-1.874 4.751l38.1 35.562a5.991 5.991 0 004.087 1.61h33.574z" fill="#0078d4" />
        <path d="M46.09.002A6.434 6.434 0 0039.93 4.5L.644 120.897a6.469 6.469 0 006.106 8.653h32.48a6.942 6.942 0 005.328-4.531l7.834-23.089 27.985 26.101a6.618 6.618 0 004.165 1.519h36.396l-15.963-45.616-46.533.011L86.922.002z" fill="url(#azure-grad-b)" transform="translate(.587 4.468) scale(.91904)" />
        <path d="M98.055 4.408A6.476 6.476 0 0091.917.002H46.575a6.478 6.478 0 016.137 4.406l39.35 116.594a6.476 6.476 0 01-6.137 8.55h45.344a6.48 6.48 0 006.136-8.55z" fill="url(#azure-grad-c)" transform="translate(.587 4.468) scale(.91904)" />
    </svg>
);

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
    meta: (s) => <Meta.Avatar size={s} />,
    huggingface: (s) => <HuggingFace.Color size={s} />,
    qwen: (s) => <Qwen.Avatar size={s} />,
    deepseek: (s) => <DeepSeek.Color size={s} />,
    ai21: (s) => <Ai21.Avatar size={s} />,
    bedrock: (s) => <AmazonIcon size={s} />,
    nova: (s) => <AmazonIcon size={s} />,
    azure: (s) => <AzureIcon size={s} />,
    cerebras: (s) => <Cerebras.Color size={s} />,
    cloudflare: (s) => <Cloudflare.Color size={s} />,
    deepinfra: (s) => <DeepInfra.Color size={s} />,
    fireworks: (s) => <Fireworks.Color size={s} />,
    nvidia: (s) => <Nvidia.Color size={s} />,
    sambanova: (s) => <SambaNova.Color size={s} />,
    upstage: (s) => <Upstage.Avatar size={s} />,
    minimax: (s) => <Minimax.Avatar size={s} />,
    moonshot: (s) => <Moonshot.Avatar size={s} />,
    stepfun: (s) => <Stepfun.Avatar size={s} />,
    baseten: (s) => <Baseten.Avatar size={s} />,
    alibaba: (s) => <Alibaba.Color size={s} />,
    baidu: (s) => <Baidu.Color size={s} />,
};

function ProviderIcon({ providerId, size = 16 }: { providerId: string; size?: number }) {
    const Icon = PROVIDER_ICONS[providerId as keyof typeof PROVIDER_ICONS];
    if (!Icon) return <div className="bg-muted rounded-sm flex items-center justify-center" style={{ width: size, height: size }}><Brain size={size * 0.8} /></div>;
    return Icon(size);
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
    const [showFreeOnly, setShowFreeOnly] = useState(false);
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
        
        // Free filter
        if (showFreeOnly) {
            result = result.filter((m) => m.free);
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
    }, [allModels, search, providerFilter, typeFilter, showFreeOnly, sortKey, sortDir]);

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
                    
                    {/* Pricing filter dropdown */}
                    <select
                        value={showFreeOnly ? "free" : "all"}
                        onChange={(e) => setShowFreeOnly(e.target.value === "free")}
                        className={cn(
                            "flex-1 sm:flex-none h-10 px-3 rounded-xl border text-sm appearance-none cursor-pointer w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-primary/20",
                            showFreeOnly 
                                ? "bg-violet-500/10 border-violet-500/30 text-violet-400" 
                                : "bg-card/50 border-border/40 text-foreground"
                        )}
                    >
                        <option value="all">All Models</option>
                        <option value="free">Free Models</option>
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
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-foreground truncate leading-tight">{model.name}</p>
                                            {model.free && (
                                                <span className="shrink-0 text-[9px] font-bold uppercase tracking-tight bg-violet-600 text-white px-1.5 py-0.5 rounded-sm">
                                                    Free
                                                </span>
                                            )}
                                        </div>
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
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-semibold text-foreground truncate leading-tight">{model.name}</div>
                                                        {model.free && (
                                                            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-widest bg-violet-600 text-white px-1.5 py-0.5 rounded-[2px]">
                                                                Free
                                                            </span>
                                                        )}
                                                    </div>
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
