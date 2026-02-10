"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";

const steps = [
    "Understanding your request...",
    "Mapping directory structure...",
    "Identifying patterns...",
    "Organizing findings...",
    "Generating response...",
];

export function ThinkingIndicator({ finished = false }: { finished?: boolean }) {
    const [currentStep, setCurrentStep] = useState(finished ? steps.length : 0);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (finished) {
            setCurrentStep(steps.length);
            return;
        }

        if (currentStep >= steps.length) return;

        const timeout = setTimeout(() => {
            setCurrentStep(prev => prev + 1);
        }, 800 + Math.random() * 800);

        return () => clearTimeout(timeout);
    }, [currentStep, finished]);

    return (
        <div className="w-full max-w-sm">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
                <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </motion.div>
                <span>
                    {currentStep < steps.length ? steps[currentStep] : "Complete"}
                </span>
                {currentStep < steps.length && (
                    <span className="animate-pulse"></span>
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
                            const isCurrent = index === currentStep;
                            const isCompleted = index < currentStep;
                            const isPending = index > currentStep;

                            if (isPending) return null;

                            return (
                                <div key={index} className={`text-[10px] font-mono ${isCurrent ? "text-foreground" : "text-muted-foreground/60"}`}>
                                    {isCompleted ? "✓" : isCurrent ? ">" : " "} {step}
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
