"use client";

import React from "react";

/**
 * Workflow Diagram - Static (like AI Gateway)
 * Shows: Trigger → Orchestrator → Steps → Decision → Outputs
 * With Human-in-the-Loop feedback
 */
export const WorkflowDiagram = () => {
    // Corner dots
    const CornerDots = ({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) => (
        <g className={color}>
            <circle cx={x} cy={y} r="3" fill="currentColor" />
            <circle cx={x + width} cy={y} r="3" fill="currentColor" />
            <circle cx={x} cy={y + height} r="3" fill="currentColor" />
            <circle cx={x + width} cy={y + height} r="3" fill="currentColor" />
        </g>
    );

    const CornerDotsMobile = ({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) => (
        <g className={color}>
            <circle cx={x} cy={y} r="2.5" fill="currentColor" />
            <circle cx={x + width} cy={y} r="2.5" fill="currentColor" />
            <circle cx={x} cy={y + height} r="2.5" fill="currentColor" />
            <circle cx={x + width} cy={y + height} r="2.5" fill="currentColor" />
        </g>
    );

    const AnimatedPath = ({ d }: { d: string }) => (
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className="text-muted-foreground/40" fill="none">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
        </path>
    );

    const X = 40;

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">Workflow</h3>
                <p className="text-muted-foreground text-sm md:text-base">
                    Visual AI pipeline builder. Chain steps, add logic, and include human approval.
                </p>
            </div>

            {/* Desktop */}
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[480px]">
                <svg viewBox="0 0 960 480" className="w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">

                    {/* ==================== LEFT: Triggers ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <rect x={30 + X} y="80" width="120" height="50" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={30 + X} y={80} width={120} height={50} color="text-orange-400" />
                        <text x={90 + X} y="110" textAnchor="middle" className="fill-orange-400 text-[14px] font-medium">Webhook</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
                        <rect x={30 + X} y="160" width="120" height="50" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={30 + X} y={160} width={120} height={50} color="text-orange-400" />
                        <text x={90 + X} y="185" textAnchor="middle" className="fill-orange-400 text-[14px] font-medium">Schedule</text>
                        <text x={90 + X} y="200" textAnchor="middle" className="fill-muted-foreground text-[10px]">Cron</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x={30 + X} y="240" width="120" height="50" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={30 + X} y={240} width={120} height={50} color="text-orange-400" />
                        <text x={90 + X} y="270" textAnchor="middle" className="fill-orange-400 text-[14px] font-medium">Event</text>
                    </g>

                    {/* Trigger → Orchestrator Paths */}
                    <AnimatedPath d={`M ${150 + X} 105 L ${190 + X} 105 L ${190 + X} 150 L ${220 + X} 150`} />
                    <AnimatedPath d={`M ${150 + X} 185 L ${190 + X} 185 L ${190 + X} 180 L ${220 + X} 180`} />
                    <AnimatedPath d={`M ${150 + X} 265 L ${190 + X} 265 L ${190 + X} 210 L ${220 + X} 210`} />

                    {/* ==================== CENTER-LEFT: Orchestrator ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <rect x={220 + X} y="120" width="160" height="120" rx="4" className="fill-indigo-400/5 stroke-indigo-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDots x={220 + X} y={120} width={160} height={120} color="text-indigo-400" />
                        <text x={300 + X} y="148" textAnchor="middle" className="fill-indigo-400 text-[16px] font-medium">Orchestrator</text>
                        <text x={300 + X} y="172" textAnchor="middle" className="fill-muted-foreground text-[11px]">Chain Logic</text>
                        <text x={300 + X} y="190" textAnchor="middle" className="fill-muted-foreground text-[11px]">Retry Policy</text>
                        <text x={300 + X} y="208" textAnchor="middle" className="fill-muted-foreground text-[11px]">Error Handling</text>
                    </g>

                    {/* Orchestrator → Steps Paths */}
                    <AnimatedPath d={`M ${380 + X} 150 L ${420 + X} 150 L ${420 + X} 85 L ${460 + X} 85`} />
                    <AnimatedPath d={`M ${380 + X} 180 L ${460 + X} 180`} />
                    <AnimatedPath d={`M ${380 + X} 210 L ${420 + X} 210 L ${420 + X} 275 L ${460 + X} 275`} />

                    {/* ==================== CENTER: Steps ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
                        <rect x={460 + X} y="60" width="130" height="50" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={460 + X} y={60} width={130} height={50} color="text-cyan-400" />
                        <text x={525 + X} y="85" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Step 1</text>
                        <text x={525 + X} y="100" textAnchor="middle" className="fill-muted-foreground text-[10px]">AI Call</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x={460 + X} y="155" width="130" height="50" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={460 + X} y={155} width={130} height={50} color="text-cyan-400" />
                        <text x={525 + X} y="180" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Step 2</text>
                        <text x={525 + X} y="195" textAnchor="middle" className="fill-muted-foreground text-[10px]">Transform</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
                        <rect x={460 + X} y="250" width="130" height="50" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={460 + X} y={250} width={130} height={50} color="text-cyan-400" />
                        <text x={525 + X} y="275" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Step 3</text>
                        <text x={525 + X} y="290" textAnchor="middle" className="fill-muted-foreground text-[10px]">Validate</text>
                    </g>

                    {/* Steps → Decision Paths - ALL converge at junction (620+X, 180) then to diamond */}
                    {/* Step 1: down to junction */}
                    <AnimatedPath d={`M ${590 + X} 85 L ${650 + X} 85 L ${650 + X} 180`} />
                    {/* Step 2: straight to junction */}
                    <AnimatedPath d={`M ${590 + X} 180 L ${650 + X} 180`} />
                    {/* Step 3: up to junction */}
                    <AnimatedPath d={`M ${590 + X} 275 L ${650 + X} 275 L ${650 + X} 180`} />
                    {/* Junction to diamond left point */}
                    <AnimatedPath d={`M ${620 + X} 180 L ${650 + X} 180`} />

                    {/* ==================== CENTER-RIGHT: Decision Diamond ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <polygon points={`${700 + X},130 ${750 + X},180 ${700 + X},230 ${650 + X},180`} className="fill-amber-400/5 stroke-amber-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <circle cx={700 + X} cy={130} r="3" className="text-amber-400" fill="currentColor" />
                        <circle cx={750 + X} cy={180} r="3" className="text-amber-400" fill="currentColor" />
                        <circle cx={700 + X} cy={230} r="3" className="text-amber-400" fill="currentColor" />
                        <circle cx={650 + X} cy={180} r="3" className="text-amber-400" fill="currentColor" />
                        <text x={700 + X} y="185" textAnchor="middle" className="fill-amber-400 text-[16px] font-medium">?</text>
                    </g>

                    {/* Decision → Outputs Paths */}
                    <AnimatedPath d={`M ${700 + X} 130 L ${700 + X} 95 L ${780 + X} 95`} />
                    <AnimatedPath d={`M ${700 + X} 230 L ${700 + X} 280 L ${780 + X} 280`} />

                    {/* ==================== RIGHT: Outputs ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.45s" }}>
                        <rect x={780 + X} y="70" width="100" height="50" rx="4" className="fill-emerald-400/5 stroke-emerald-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={780 + X} y={70} width={100} height={50} color="text-emerald-400" />
                        <text x={830 + X} y="100" textAnchor="middle" className="fill-emerald-400 text-[13px] font-medium">Approve</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <rect x={780 + X} y="255" width="100" height="50" rx="4" className="fill-rose-400/5 stroke-rose-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={780 + X} y={255} width={100} height={50} color="text-rose-400" />
                        <text x={830 + X} y="285" textAnchor="middle" className="fill-rose-400 text-[13px] font-medium">Reject</text>
                    </g>

                    {/* ==================== BOTTOM: Human in the Loop ==================== */}
                    {/* Decision → Human Path */}
                    <AnimatedPath d={`M ${750 + X} 180 L ${780 + X} 180 L ${780 + X} 380 L ${620 + X} 380`} />

                    <g className="animate-fade-in" style={{ animationDelay: "0.55s" }}>
                        <rect x={440 + X} y="355" width="180" height="55" rx="4" className="fill-purple-400/5 stroke-purple-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={440 + X} y={355} width={180} height={55} color="text-purple-400" />
                        <text x={530 + X} y="388" textAnchor="middle" className="fill-purple-400 text-[14px] font-medium">Human Review</text>
                    </g>

                    {/* Human → Orchestrator Feedback Path */}
                    <AnimatedPath d={`M ${440 + X} 382 L ${180 + X} 382 L ${180 + X} 260 L ${220 + X} 260`} />
                </svg>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex flex-col items-center">
                <svg viewBox="0 0 300 400" className="w-full max-w-[300px] h-auto" fill="none" preserveAspectRatio="xMidYMid meet">
                    <AnimatedPath d="M 150 50 L 150 75" />
                    <AnimatedPath d="M 150 135 L 150 160" />
                    <AnimatedPath d="M 150 220 L 150 245" />
                    <AnimatedPath d="M 150 305 L 150 330" />

                    <g className="animate-fade-in">
                        <rect x="75" y="15" width="150" height="40" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={75} y={15} width={150} height={40} color="text-orange-400" />
                        <text x="150" y="40" textAnchor="middle" className="fill-orange-400 text-[13px] font-medium">Trigger</text>
                    </g>

                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="55" y="75" width="190" height="60" rx="4" className="fill-indigo-400/5 stroke-indigo-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={55} y={75} width={190} height={60} color="text-indigo-400" />
                        <text x="150" y="105" textAnchor="middle" className="fill-indigo-400 text-[13px] font-medium">Orchestrator</text>
                        <text x="150" y="125" textAnchor="middle" className="fill-muted-foreground text-[9px]">Chain • Retry • Error</text>
                    </g>

                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect x="75" y="160" width="150" height="60" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={75} y={160} width={150} height={60} color="text-cyan-400" />
                        <text x="150" y="190" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Steps</text>
                        <text x="150" y="210" textAnchor="middle" className="fill-muted-foreground text-[9px]">AI Call → Transform → Validate</text>
                    </g>

                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <polygon points="150,245 190,275 150,305 110,275" className="fill-amber-400/5 stroke-amber-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <text x="150" y="280" textAnchor="middle" className="fill-amber-400 text-[14px] font-medium">?</text>
                    </g>

                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="75" y="330" width="150" height="50" rx="4" className="fill-purple-400/5 stroke-purple-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={75} y={330} width={150} height={50} color="text-purple-400" />
                        <text x="150" y="360" textAnchor="middle" className="fill-purple-400 text-[13px] font-medium">Human Review</text>
                    </g>
                </svg>
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/30 -mx-8 px-8">
                <span className="text-sm text-muted-foreground flex items-center gap-2"><span className="text-indigo-400">✓</span> Visual builder</span>
                <span className="text-sm text-muted-foreground flex items-center gap-2"><span className="text-indigo-400">✓</span> Human-in-the-loop</span>
                <span className="text-sm text-muted-foreground flex items-center gap-2"><span className="text-indigo-400">✓</span> Event-driven</span>
            </div>
        </div>
    );
};
