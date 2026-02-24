"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface ScanThinkingIndicatorProps {
    finished?: boolean;
    /** Live reasoning text streamed from gpt-oss-120b. When provided, the
     *  component shows the actual model thoughts instead of fake step messages. */
    liveText?: string;
}

// Fallback steps shown when no liveText is provided (e.g. during initial load)
const FALLBACK_STEPS = [
    "Connecting to the repo...",
    "Pulling up your scan data...",
    "Reading every line of code...",
    "Sniffing out vulnerabilities...",
    "Mapping the blast radius...",
    "Analyzing the attack surface...",
    "Triaging by severity...",
    "Cross-referencing OWASP Top 10...",
    "Consulting the CVE database...",
    "Brewing your remediation plan...",
    "Prioritizing the nastiest issues first...",
    "Writing the security brief...",
];

function shuffleSteps(count = 7): string[] {
    const pool = [...FALLBACK_STEPS];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

export function ScanThinkingIndicator({ finished = false, liveText }: ScanThinkingIndicatorProps) {
    const stepsRef = useRef<string[]>(shuffleSteps());
    const steps = stepsRef.current;

    const [currentStep, setCurrentStep] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand when live reasoning text starts arriving
    useEffect(() => {
        if (liveText && liveText.length > 0 && !isExpanded) {
            setIsExpanded(true);
        }
    }, [liveText, isExpanded]);

    useEffect(() => {
        if (finished) {
            setCurrentStep(steps.length);
            return;
        }
    }, [finished, steps.length]);

    useEffect(() => {
        if (finished || currentStep >= steps.length) return;
        // When live text is flowing we don't cycle fake steps
        if (liveText) return;
        const delay = 650 + Math.random() * 950;
        const timeout = setTimeout(() => setCurrentStep((prev) => prev + 1), delay);
        return () => clearTimeout(timeout);
    }, [currentStep, finished, steps.length, liveText]);

    const isRunning = !finished && (liveText ? liveText.length > 0 : currentStep < steps.length);

    // Header label: when live text is available show the last ~60 chars of it
    const label = (() => {
        if (finished) return "Complete";
        if (liveText && liveText.length > 0) {
            // Show the last meaningful sentence fragment from the reasoning
            const trimmed = liveText.trimEnd();
            const lastNl = trimmed.lastIndexOf("\n");
            const lastLine = lastNl >= 0 ? trimmed.slice(lastNl + 1).trim() : trimmed;
            return lastLine.length > 0 ? lastLine.slice(-70) : "Thinking...";
        }
        return currentStep >= steps.length ? "Complete" : steps[currentStep];
    })();

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
                        {liveText ? (
                            /* Live reasoning mode — scrollable terminal-like view */
                            <div className="max-h-48 overflow-y-auto text-[10px] font-mono text-muted-foreground/70 leading-relaxed whitespace-pre-wrap py-1">
                                {liveText}
                                {!finished && (
                                    <span className="inline-block w-1.5 h-3 bg-emerald-400/70 animate-pulse ml-0.5 align-middle" />
                                )}
                            </div>
                        ) : (
                            /* Fallback mode — show cycling fake steps */
                            <div className="space-y-1 py-1">
                                {steps.slice(0, Math.max(currentStep, 1)).map((step, index) => {
                                    const isCurrent = index === currentStep && !finished;
                                    const isDone = index < currentStep || finished;
                                    return (
                                        <div
                                            key={index}
                                            className={`text-[10px] font-mono ${isCurrent ? "text-foreground" : "text-muted-foreground/60"}`}
                                        >
                                            {isDone && !isCurrent ? "✓" : isCurrent ? "›" : " "} {step}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
