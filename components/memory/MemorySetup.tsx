'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SNIPPET = `const response = await cencori.chat.completions.create({
  model: 'gpt-4o',
  messages,
  memory: { userId: user.id },
});`;

/** Empty-state setup: the one field that turns memory on for a request. */
export function MemorySetup({ title, description }: { title: string; description: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(SNIPPET);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="mx-auto flex max-w-[560px] flex-col items-center px-5 py-12 text-center">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>

            <div className="relative mt-5 w-full overflow-hidden rounded-md border border-border/40 bg-background text-left">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={copy}
                    aria-label={copied ? 'Copied' : 'Copy code'}
                    className="absolute right-1.5 top-1.5 h-7 w-7 text-muted-foreground"
                >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-5">
                    <code>{SNIPPET}</code>
                </pre>
            </div>

            <a
                href="/docs/memory"
                target="_blank"
                rel="noreferrer"
                className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
                Read the memory docs
            </a>
        </div>
    );
}
