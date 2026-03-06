"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

interface ScanThinkingIndicatorProps {
    finished?: boolean;
    /** Live investigation text streamed from the backend. */
    liveText?: string;
}

export function ScanThinkingIndicator({ finished = false, liveText }: ScanThinkingIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom while investigation steps are streaming
    useEffect(() => {
        if (!finished && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [liveText, finished]);

    // Collapse as soon as content starts arriving (finished=true)
    useEffect(() => {
        if (finished) setIsExpanded(false);
    }, [finished]);

    const isRunning = !finished;
    const analysisLines = liveText
        ? liveText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => line.replace(/^[*-]\s*/, ""))
        : [];

    const label = finished
        ? "Investigation complete"
        : analysisLines.length > 0
            ? (() => {
                const lastLine = analysisLines[analysisLines.length - 1] || "";
                return lastLine.slice(0, 90);
            })()
            : "Investigating security context...";

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
                        {analysisLines.length > 0 ? (
                            <div
                                ref={scrollRef}
                                className="max-h-56 overflow-y-auto py-1"
                            >
                                <div className="space-y-2">
                                    {analysisLines.map((line, index) => (
                                        <div key={`${line}-${index}`} className="flex items-start gap-2 text-[11px] font-mono text-muted-foreground leading-relaxed">
                                            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                                            <span>{line}</span>
                                        </div>
                                    ))}
                                </div>
                                {!finished && (
                                    <div className="flex items-center gap-2 pt-2 text-[10px] font-mono text-muted-foreground/60">
                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
                                        Continuing investigation...
                                    </div>
                                )}
                            </div>
                        ) : (
                            // No analysis yet — simple waiting state
                            <div className="flex items-center gap-2 py-2 text-[10px] font-mono text-muted-foreground/50">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
                                Cencori is thinking...
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
