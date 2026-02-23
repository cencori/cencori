"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

// ─── One big combined pool — all phases merged and shuffled ──────────────────

const ALL_STEPS = [
    "Connecting to the repo...",
    "Pulling up your scan data...",
    "Working on scanned repo...",
    "Reading every line of code...",
    "Sniffing out vulnerabilities...",
    "Checking for secrets in weird places...",
    "Mapping the blast radius...",
    "Analyzing the attack surface...",
    "Cleaning up the dirt...",
    "Cooking...",
    "Triaging by severity...",
    "Cross-referencing OWASP Top 10...",
    "Consulting the CVE database...",
    "Brewing your remediation plan...",
    "Generating safe code patterns...",
    "Prioritizing the nastiest issues first...",
    "Chill, let me cook...",
    "Writing the security brief...",
    "Checking for edge cases...",
    "Running the scenario through...",
];

function shuffleSteps(count: number = 7): string[] {
    const pool = [...ALL_STEPS];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

interface ScanThinkingIndicatorProps {
    finished?: boolean;
}

export function ScanThinkingIndicator({ finished = false }: ScanThinkingIndicatorProps) {
    const stepsRef = useRef<string[]>(shuffleSteps());
    const steps = stepsRef.current;

    const [currentStep, setCurrentStep] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (finished) {
            setCurrentStep(steps.length);
            return;
        }
    }, [finished, steps.length]);

    useEffect(() => {
        if (finished || currentStep >= steps.length) return;
        const delay = 650 + Math.random() * 950;
        const timeout = setTimeout(() => setCurrentStep((prev) => prev + 1), delay);
        return () => clearTimeout(timeout);
    }, [currentStep, finished, steps.length]);

    const isRunning = !finished && currentStep < steps.length;
    const label = currentStep >= steps.length ? "Complete" : steps[currentStep];

    return (
        <div className="w-full max-w-sm">
            <button
                onClick={() => setIsExpanded((v) => !v)}
                className="flex items-center gap-2 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors w-full text-left"
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
                        {steps.slice(0, Math.max(currentStep, 1)).map((step, index) => {
                            const isCurrent = index === currentStep && !finished;
                            const isDone = index < currentStep || finished;
                            return (
                                <div
                                    key={index}
                                    className={`text-[10px] font-mono ${isCurrent ? "text-foreground" : "text-muted-foreground/60"
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
