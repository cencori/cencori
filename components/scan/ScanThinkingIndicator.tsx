"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

interface ScanThinkingIndicatorProps {
    finished?: boolean;
    /** Live reasoning text streamed from gpt-oss-120b. */
    liveText?: string;
}

export function ScanThinkingIndicator({ finished = false, liveText }: ScanThinkingIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom while reasoning is streaming
    useEffect(() => {
        if (!finished && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [liveText, finished]);

    const isRunning = !finished;

    const label = finished
        ? "Complete"
        : liveText && liveText.length > 0
            ? (() => {
                // Show the last non-empty line of reasoning
                const lines = liveText.trimEnd().split("\n");
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.length > 0) return line.slice(-70);
                }
                return "Thinking...";
            })()
            : "Thinking...";

    return (
        <div className="w-full">
            <button
                onClick={() => setIsExpanded((v) => !v)}
                className="flex items-center gap-2 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight className="w-3.5 h-3.5" />
                </motion.div>
                <span className="truncate max-w-sm">{label}</span>
                {isRunning && (
                    <span className="ml-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                )}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-l border-border/40 ml-2 pl-4 mb-2"
                    >
                        {liveText && liveText.length > 0 ? (
                            <div
                                ref={scrollRef}
                                className="max-h-56 overflow-y-auto text-[10px] font-mono text-muted-foreground/70 leading-relaxed whitespace-pre-wrap py-1"
                            >
                                {liveText}
                                {!finished && (
                                    <span className="inline-block w-1.5 h-3 bg-emerald-400/70 animate-pulse ml-0.5 align-middle" />
                                )}
                            </div>
                        ) : (
                            // No reasoning yet — simple waiting state
                            <div className="flex items-center gap-2 py-2 text-[10px] font-mono text-muted-foreground/50">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
                                Waiting for cencori...
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
