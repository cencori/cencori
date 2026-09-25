"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  OpenAI,
  Anthropic,
  Google,
  Mistral,
  Cohere,
  Perplexity,
  Groq,
  XAI,
  Together,
  Meta,
  HuggingFace,
  Qwen,
  DeepSeek,
  Minimax,
  Baidu,
  ZAI,
  Cerebras,
} from "@lobehub/icons";
import { Brain, Check, ChevronDown, Search, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentModel = { id: string; name: string; provider: string };

function MaximoIcon({ size }: { size: number }) {
  return (
    <img
      src="/partners/max.jpeg"
      alt="Maximo AI"
      width={size}
      height={size}
      className="rounded-[4px] object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function HelixIcon({ size }: { size: number }) {
  return (
    <img
      src="/providers/helix.svg"
      alt="Helix"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

const PROVIDER_ICONS: Record<string, (size: number) => React.ReactNode> = {
  openai: (s) => <OpenAI size={s} />,
  anthropic: (s) => <Anthropic size={s} />,
  google: (s) => <Google.Color size={s} />,
  mistral: (s) => <Mistral.Color size={s} />,
  cohere: (s) => <Cohere.Color size={s} />,
  perplexity: (s) => <Perplexity.Color size={s} />,
  groq: (s) => <Groq size={s} />,
  together: (s) => <Together.Color size={s} />,
  xai: (s) => <XAI size={s} />,
  meta: (s) => <Meta.Avatar size={s} />,
  huggingface: (s) => <HuggingFace.Color size={s} />,
  qwen: (s) => <Qwen.Avatar size={s} />,
  deepseek: (s) => <DeepSeek.Color size={s} />,
  minimax: (s) => <Minimax.Avatar size={s} />,
  baidu: (s) => <Baidu.Color size={s} />,
  zai: (s) => <ZAI size={s} />,
  cerebras: (s) => <Cerebras size={s} />,
  maximo: (s) => <MaximoIcon size={s} />,
  helix: (s) => <HelixIcon size={s} />,
};

export function ModelProviderIcon({ providerId, size = 14 }: { providerId: string; size?: number }) {
  const key = providerId.toLowerCase().replace(/^custom:/, "").trim();
  const Icon = PROVIDER_ICONS[key];
  if (!Icon) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-[5px] bg-muted"
        style={{ width: size + 6, height: size + 6 }}
      >
        <Brain className="text-muted-foreground/60" style={{ width: size - 2, height: size - 2 }} />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-muted/60"
      style={{ width: size + 6, height: size + 6 }}
    >
      {Icon(size)}
    </span>
  );
}

export function ModelSelect({
  value,
  onChange,
  models,
  disabled = false,
  placeholder = "Choose a model",
  labelClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  models: AgentModel[];
  disabled?: boolean;
  placeholder?: string;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => models.find((m) => m.id === value) ?? null,
    [models, value]
  );
  const isStale = !!value && !selected;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open ]);

  const flatList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? models.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q)
        )
      : models;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [models, query]);

  const totalCount = models.length;

  return (
    <div ref={rootRef} className={cn("relative", labelClassName)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md border border-border/70 bg-background px-3 py-2.5 text-left text-sm text-foreground outline-none transition-colors",
          "hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-ring ring-2 ring-ring/10"
        )}
      >
        {selected ? (
          <>
            <ModelProviderIcon providerId={selected.provider} size={14} />
            <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
          </>
        ) : isStale ? (
          <>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-amber-500/15">
              <TriangleAlert className="h-3 w-3 text-amber-500" />
            </span>
            <span className="min-w-0 flex-1 truncate">{value}</span>
            <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Unavailable
            </span>
          </>
        ) : (
          <span className="flex-1 truncate text-muted-foreground/60">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border/70 bg-popover shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150">
          <div className="border-b border-border/50 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${totalCount} models...`}
                className="h-8 w-full rounded-md border border-transparent bg-muted/50 pl-8 pr-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring/50 focus:bg-muted/70"
              />
            </div>
          </div>

          <div
            role="listbox"
            aria-label="Models"
            className="max-h-72 overflow-y-auto overscroll-contain p-1.5"
          >
            {value && (
              <button
                type="button"
                role="option"
                aria-selected={!selected && !isStale}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] transition-colors hover:bg-accent",
                  !value ? "bg-accent" : ""
                )}
              >
                <span className="flex-1 truncate text-muted-foreground">{placeholder}</span>
                {!value && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
              </button>
            )}

            {isStale && (
              <div className="mb-1 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2 py-2">
                <div className="flex items-center gap-2">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{value}</p>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Unavailable
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  This model is no longer available. Pick a replacement below.
                </p>
              </div>
            )}

            {flatList.length === 0 && (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                {query ? (
                  <>
                    No models match &ldquo;{query}&rdquo;.
                  </>
                ) : (
                  "No models available."
                )}
              </p>
            )}

            {flatList.map((model) => {
              const isSelected = model.id === value;
              return (
                <button
                  key={`${model.provider}:${model.id}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                    isSelected ? "bg-accent" : "hover:bg-accent/70"
                  )}
                >
                  <ModelProviderIcon providerId={model.provider} size={13} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-5">
                      {model.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] leading-4 text-muted-foreground/70">
                      {model.id}
                    </span>
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
