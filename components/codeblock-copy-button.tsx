"use client";

import { useState } from 'react';
import { CheckIcon, CopyIcon } from '@/assets/icons';
import { cn } from '@/lib/utils';

export function CopyButton({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      className={cn(
        "absolute top-4 right-4 z-10 h-7 w-7 rounded-lg flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm border border-border/40",
        "hover:bg-background hover:border-border/60",
        "active:scale-95 transition-all duration-150",
        "text-muted-foreground hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        className,
      )}
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-500" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}
