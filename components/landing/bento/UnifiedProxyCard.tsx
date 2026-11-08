"use client";

import React from "react";
import { BentoCard } from "./BentoCard";
import { cn } from "@/lib/utils";

const codeLines = [
    { text: 'import', className: 'text-purple-400' },
    { text: ' { Cencori }', className: 'text-foreground' },
    { text: ' from', className: 'text-purple-400' },
    { text: " 'cencori'", className: 'text-emerald-400' },
    { text: ';', className: 'text-foreground' },
    { text: '\n\n', className: '' },
    { text: 'const', className: 'text-purple-400' },
    { text: ' client', className: 'text-foreground' },
    { text: ' = ', className: 'text-foreground' },
    { text: 'new', className: 'text-purple-400' },
    { text: ' Cencori', className: 'text-amber-300' },
    { text: '({ ', className: 'text-foreground' },
    { text: 'apiKey', className: 'text-foreground' },
    { text: ': ', className: 'text-foreground' },
    { text: "'your-key'", className: 'text-emerald-400' },
    { text: ' });', className: 'text-foreground' },
    { text: '\n\n', className: '' },
    { text: '// Works with any provider', className: 'text-muted-foreground' },
    { text: '\n', className: '' },
    { text: 'const', className: 'text-purple-400' },
    { text: ' response', className: 'text-foreground' },
    { text: ' = ', className: 'text-foreground' },
    { text: 'await', className: 'text-purple-400' },
    { text: ' client.chat.', className: 'text-foreground' },
    { text: 'completions', className: 'text-amber-300' },
    { text: '({', className: 'text-foreground' },
    { text: '\n  ', className: '' },
    { text: 'provider', className: 'text-foreground' },
    { text: ': ', className: 'text-foreground' },
    { text: "'openai'", className: 'text-emerald-400' },
    { text: ',', className: 'text-foreground' },
    { text: '\n  ', className: '' },
    { text: 'model', className: 'text-foreground' },
    { text: ': ', className: 'text-foreground' },
    { text: "'gpt-4o'", className: 'text-emerald-400' },
    { text: ',', className: 'text-foreground' },
    { text: '\n  ', className: '' },
    { text: 'messages', className: 'text-foreground' },
    { text: ': [{ ', className: 'text-foreground' },
    { text: 'role', className: 'text-foreground' },
    { text: ': ', className: 'text-foreground' },
    { text: "'user'", className: 'text-emerald-400' },
    { text: ', ', className: 'text-foreground' },
    { text: 'content', className: 'text-foreground' },
    { text: ': ', className: 'text-foreground' },
    { text: "'Hello!'", className: 'text-emerald-400' },
    { text: ' }]', className: 'text-foreground' },
    { text: '\n', className: '' },
    { text: '});', className: 'text-foreground' },
];

// Static code display (no animation)
const StaticCode = () => {
    return (
        <pre className="font-mono text-xs leading-relaxed overflow-hidden">
            <code>
                {codeLines.map((token, i) => (
                    <span key={i} className={token.className}>
                        {token.text}
                    </span>
                ))}
            </code>
        </pre>
    );
};

export const UnifiedProxyCard = () => {
    return (
        <BentoCard
            title="Unified Proxy"
            description="One endpoint for OpenAI, Anthropic, Google, and more. Switch providers with a single line change."
            accentColor="green"
        >
            <div
                className={cn(
                    "relative rounded-lg border border-border/60 bg-muted/30 p-4 overflow-hidden",
                    "group-hover:border-emerald-500/30 transition-colors duration-300"
                )}
            >
                {/* Window header */}
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/60">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">app.ts</span>
                </div>

                {/* Static code content */}
                <StaticCode />
            </div>

            {/* Supported providers section */}
            <div className="mt-4 pt-4 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Supported Providers</p>
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full border border-emerald-500/20">OpenAI</span>
                    <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[10px] rounded-full border border-orange-500/20">Anthropic</span>
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] rounded-full border border-blue-500/20">Google</span>
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] rounded-full border border-purple-500/20">Cohere</span>
                    <span className="px-2 py-1 bg-pink-500/10 text-pink-400 text-[10px] rounded-full border border-pink-500/20">Mistral</span>
                    <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] rounded-full border border-cyan-500/20">AWS Bedrock</span>
                </div>
            </div>

            {/* Feature highlights */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="text-emerald-400">✓</span> Zero vendor lock-in
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="text-emerald-400">✓</span> Auto-retry & failover
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="text-emerald-400">✓</span> OpenAI-compatible API
                </span>
            </div>
        </BentoCard>
    );
};
