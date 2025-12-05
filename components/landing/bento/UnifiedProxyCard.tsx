"use client";

import React, { useState, useEffect, useRef } from "react";
import { BentoCard } from "./BentoCard";
import { cn } from "@/lib/utils";

const codeLines = [
    { text: 'import', className: 'text-purple-400' },
    { text: ' { Cencori }', className: 'text-white' },
    { text: ' from', className: 'text-purple-400' },
    { text: " 'cencori'", className: 'text-emerald-400' },
    { text: ';', className: 'text-white' },
    { text: '\n\n', className: '' },
    { text: 'const', className: 'text-purple-400' },
    { text: ' client', className: 'text-white' },
    { text: ' = ', className: 'text-white' },
    { text: 'new', className: 'text-purple-400' },
    { text: ' Cencori', className: 'text-amber-300' },
    { text: '({ ', className: 'text-white' },
    { text: 'apiKey', className: 'text-white' },
    { text: ': ', className: 'text-white' },
    { text: "'your-key'", className: 'text-emerald-400' },
    { text: ' });', className: 'text-white' },
    { text: '\n\n', className: '' },
    { text: '// Works with any provider', className: 'text-white/40' },
    { text: '\n', className: '' },
    { text: 'const', className: 'text-purple-400' },
    { text: ' response', className: 'text-white' },
    { text: ' = ', className: 'text-white' },
    { text: 'await', className: 'text-purple-400' },
    { text: ' client.chat.', className: 'text-white' },
    { text: 'completions', className: 'text-amber-300' },
    { text: '({', className: 'text-white' },
    { text: '\n  ', className: '' },
    { text: 'provider', className: 'text-white' },
    { text: ': ', className: 'text-white' },
    { text: "'openai'", className: 'text-emerald-400' },
    { text: ',', className: 'text-white' },
    { text: '\n  ', className: '' },
    { text: 'model', className: 'text-white' },
    { text: ': ', className: 'text-white' },
    { text: "'gpt-4o'", className: 'text-emerald-400' },
    { text: ',', className: 'text-white' },
    { text: '\n  ', className: '' },
    { text: 'messages', className: 'text-white' },
    { text: ': [{ ', className: 'text-white' },
    { text: 'role', className: 'text-white' },
    { text: ': ', className: 'text-white' },
    { text: "'user'", className: 'text-emerald-400' },
    { text: ', ', className: 'text-white' },
    { text: 'content', className: 'text-white' },
    { text: ': ', className: 'text-white' },
    { text: "'Hello!'", className: 'text-emerald-400' },
    { text: ' }]', className: 'text-white' },
    { text: '\n', className: '' },
    { text: '});', className: 'text-white' },
];

const TypewriterCode = ({ isHovered }: { isHovered: boolean }) => {
    const [displayedTokens, setDisplayedTokens] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Reset and animate when hovered
        if (isHovered) {
            setDisplayedTokens(0);
            intervalRef.current = setInterval(() => {
                setDisplayedTokens((prev) => {
                    if (prev >= codeLines.length) {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 30);
        } else {
            // Show full code when not hovered
            setDisplayedTokens(codeLines.length);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isHovered]);

    return (
        <pre className="font-mono text-xs leading-relaxed overflow-hidden">
            <code>
                {codeLines.slice(0, displayedTokens).map((token, i) => (
                    <span key={i} className={token.className}>
                        {token.text}
                    </span>
                ))}
                {displayedTokens < codeLines.length && displayedTokens > 0 && (
                    <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5" />
                )}
            </code>
        </pre>
    );
};

export const UnifiedProxyCard = () => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <BentoCard
                title="Unified Proxy"
                description="One endpoint for OpenAI, Anthropic, Google, and more. Switch providers with a single line change."
                accentColor="green"
                gridClassName="md:col-span-2 md:row-span-2"
            >
                <div
                    className={cn(
                        "relative rounded-lg border border-white/[0.08] bg-black/50 p-4 overflow-hidden transition-all duration-300",
                        "group-hover:border-emerald-500/20"
                    )}
                >
                    {/* Window header */}
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.08]">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                        </div>
                        <span className="text-xs text-white/40 ml-2">app.ts</span>
                    </div>

                    {/* Code content */}
                    <TypewriterCode isHovered={isHovered} />

                    {/* Glow effect */}
                    <div
                        className={cn(
                            "absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-3xl transition-opacity duration-500",
                            "bg-emerald-500/20",
                            isHovered ? "opacity-100" : "opacity-0"
                        )}
                    />
                </div>
            </BentoCard>
        </div>
    );
};
