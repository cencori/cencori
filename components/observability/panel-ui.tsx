'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';

/** Building blocks of Observability's right-hand detail panels. */

export function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button" aria-label="Copy"
            onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
        >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

export type KVRow = [label: string, value: React.ReactNode, copy?: string] | false | null | undefined;

export function KV({ rows }: { rows: KVRow[] }) {
    const visible = rows.filter(Boolean) as Array<[string, React.ReactNode, string?]>;
    return (
        <div className="divide-y divide-border/40 rounded-md border border-border/50">
            {visible.map(([label, value, copy]) => (
                <div key={label} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="shrink-0 text-muted-foreground">{label}</span>
                    <span className="ml-auto flex min-w-0 items-center gap-1.5 font-mono text-[11px]">
                        <span className="truncate">{value}</span>
                        {copy && <CopyButton text={copy} />}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function Card({ title, summary, children, defaultOpen = false }: { title: string; summary?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-md border border-border/50">
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs">
                {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <span className="font-medium">{title}</span>
                {summary !== undefined && <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">{summary}</span>}
            </button>
            {open && <div className="border-t border-border/40 p-3">{children}</div>}
        </div>
    );
}

export function Pre({ value, empty = '—' }: { value: unknown; empty?: string }) {
    const text = value === null || value === undefined || value === '' ? empty : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{text}</pre>;
}
