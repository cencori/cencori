"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

// ─── Step pools per context ───────────────────────────────────────────────────

const STEP_POOLS = {
    loading: [
        "Connecting to the repo...",
        "Pulling up your scan data...",
        "Dusting off the findings...",
        "Cracking open the results...",
        "Waking up the security engine...",
    ],
    generating: [
        "Working on scanned repo...",
        "Analyzing the attack surface...",
        "Reading every line of code...",
        "Sniffing out vulnerabilities...",
        "Checking for secrets in weird places...",
        "Mapping the blast radius...",
        "Cleaning up the dirt...",
        "Cooking...",
        "Building your fix plan...",
        "Triaging by severity...",
    ],
    streaming: [
        "Brewing your remediation plan...",
        "Translating vulnerabilities to English...",
        "Writing the security brief...",
        "Prioritizing the nastiest issues first...",
        "Cleaning up the dirt...",
        "Cooking...",
        "Consulting the CVE database...",
        "Cross-referencing OWASP Top 10...",
        "Generating safe code patterns...",
    ],
    chat: [
        "Thinking about your question...",
        "Consulting the security playbook...",
        "Cooking...",
        "Deep diving into the code path...",
        "Checking best practices...",
        "Running the scenario through...",
        "Checking for edge cases...",
        "Cleaning up the dirt...",
    ],
} as const;

export type ScanThinkingPhase = keyof typeof STEP_POOLS;

function pickSteps(phase: ScanThinkingPhase, count: number = 5): string[] {
    const pool = [...STEP_POOLS[phase]];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

interface ScanThinkingIndicatorProps {
    phase?: ScanThinkingPhase;
    finished?: boolean;
    /** Override steps entirely (optional) */
    steps?: string[];
}

export function ScanThinkingIndicator({
    phase = "generating",
    finished = false,
    steps: stepsProp,
}: ScanThinkingIndicatorProps) {
    const stepsRef = useRef<string[]>(stepsProp ?? pickSteps(phase));
    const steps = stepsRef.current;

    const [currentStep, setCurrentStep] = useState(finished ? steps.length : 0);
    const [isExpanded, setIsExpanded] = useState(false);

    // When finished flips to true, jump to end
    useEffect(() => {
        if (finished) {
            setCurrentStep(steps.length);
        }
    }, [finished, steps.length]);

    // Advance steps while not finished
    useEffect(() => {
        if (finished || currentStep >= steps.length) return;
        const delay = 700 + Math.random() * 900;
        const timeout = setTimeout(() => setCurrentStep((prev) => prev + 1), delay);
        return () => clearTimeout(timeout);
    }, [currentStep, finished, steps.length]);

    const label = currentStep < steps.length ? steps[currentStep] : "Complete";
    const isRunning = currentStep < steps.length && !finished;

    return (
        <div className="w-full max-w-sm">
            <button
                onClick={() => setIsExpanded((v) => !v)}
                className="flex items-center gap-2 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight className="w-3.5 h-3.5" />
                </motion.div>
                <span>{label}</span>
                {isRunning && (
                    <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-l border-border/40 ml-2 pl-4 space-y-1 mb-2"
                    >
                        {steps.map((step, index) => {
                            if (index > currentStep) return null;
                            const isCurrent = index === currentStep && !finished;
                            const isDone = index < currentStep || finished;
                            return (
                                <div
                                    key={index}
                                    className={`text-[10px] font-mono ${isCurrent
                                            ? "text-foreground"
                                            : isDone
                                                ? "text-muted-foreground/60"
                                                : "text-muted-foreground/30"
                                        }`}
                                >
                                    {isDone && !isCurrent ? "✓" : isCurrent ? "›" : " "} {step}
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
