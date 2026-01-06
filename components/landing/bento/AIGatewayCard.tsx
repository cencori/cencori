"use client";

import React from "react";
import { BentoCard } from "./BentoCard";

/**
 * AI Gateway Card - Vertical animated architecture diagram
 * Cloudflare-style with corner dots
 */
export const AIGatewayCard = () => {
    // Reusable corner dots component
    const CornerDots = ({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) => (
        <g className={color}>
            {/* Top-left */}
            <circle cx={x} cy={y} r="3" fill="currentColor" />
            {/* Top-right */}
            <circle cx={x + width} cy={y} r="3" fill="currentColor" />
            {/* Bottom-left */}
            <circle cx={x} cy={y + height} r="3" fill="currentColor" />
            {/* Bottom-right */}
            <circle cx={x + width} cy={y + height} r="3" fill="currentColor" />
        </g>
    );

    return (
        <BentoCard
            title="AI Gateway"
            description="Unified endpoint for all AI providers with security, routing, and observability built-in."
            accentColor="green"
        >
            {/* Animated Architecture Diagram - Vertical Layout - Full Size */}
            <div className="relative w-full flex-1 mt-4 flex justify-center items-center">
                <svg
                    viewBox="0 0 380 420"
                    className="w-full h-full max-h-[380px]"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Background dot grid pattern */}
                    <defs>
                        <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle cx="10" cy="10" r="1" className="fill-muted-foreground/20" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dotGrid)" />

                    {/* Request Node */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <rect
                            x="115" y="10" width="150" height="50" rx="4"
                            className="fill-blue-400/5 stroke-blue-400/60"
                            strokeWidth="1.5"
                            strokeDasharray="8 4"
                        />
                        <CornerDots x={115} y={10} width={150} height={50} color="text-blue-400" />
                        <text x="190" y="40" textAnchor="middle" className="fill-blue-400 text-[14px] font-medium">
                            Request
                        </text>
                    </g>

                    {/* Line: Request → Security */}
                    <path
                        d="M 190 60 L 190 90"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>

                    {/* Security Node */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect
                            x="85" y="90" width="210" height="65" rx="4"
                            className="fill-emerald-400/5 stroke-emerald-400/60"
                            strokeWidth="1.5"
                            strokeDasharray="8 4"
                        />
                        <CornerDots x={85} y={90} width={210} height={65} color="text-emerald-400" />
                        <text x="190" y="120" textAnchor="middle" className="fill-emerald-400 text-[14px] font-medium">
                            Security
                        </text>
                        <text x="190" y="140" textAnchor="middle" className="fill-muted-foreground text-[11px]">
                            PII • Jailbreak • Content Filter
                        </text>
                    </g>

                    {/* Line: Security → Router */}
                    <path
                        d="M 190 155 L 190 185"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>

                    {/* Router Node */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect
                            x="100" y="185" width="180" height="60" rx="4"
                            className="fill-purple-400/5 stroke-purple-400/60"
                            strokeWidth="1.5"
                            strokeDasharray="8 4"
                        />
                        <CornerDots x={100} y={185} width={180} height={60} color="text-purple-400" />
                        <text x="190" y="215" textAnchor="middle" className="fill-purple-400 text-[14px] font-medium">
                            Router
                        </text>
                        <text x="190" y="233" textAnchor="middle" className="fill-muted-foreground text-[11px]">
                            Failover • Load Balance
                        </text>
                    </g>

                    {/* Lines: Router → Providers (branching) */}
                    <path
                        d="M 140 245 L 70 275"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>
                    <path
                        d="M 190 245 L 190 275"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>
                    <path
                        d="M 240 245 L 310 275"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>

                    {/* Provider Nodes */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        {/* OpenAI */}
                        <rect
                            x="15" y="275" width="105" height="42" rx="4"
                            className="fill-orange-400/5 stroke-orange-400/60"
                            strokeWidth="1.5"
                            strokeDasharray="6 3"
                        />
                        <CornerDots x={15} y={275} width={105} height={42} color="text-orange-400" />
                        <text x="67" y="302" textAnchor="middle" className="fill-orange-400 text-[12px]">
                            OpenAI
                        </text>

                        {/* Anthropic */}
                        <rect
                            x="137" y="275" width="105" height="42" rx="4"
                            className="fill-orange-400/5 stroke-orange-400/60"
                            strokeWidth="1.5"
                            strokeDasharray="6 3"
                        />
                        <CornerDots x={137} y={275} width={105} height={42} color="text-orange-400" />
                        <text x="190" y="302" textAnchor="middle" className="fill-orange-400 text-[12px]">
                            Anthropic
                        </text>

                        {/* Gemini */}
                        <rect
                            x="260" y="275" width="105" height="42" rx="4"
                            className="fill-orange-400/5 stroke-orange-400/60"
                            strokeWidth="1.5"
                            strokeDasharray="6 3"
                        />
                        <CornerDots x={260} y={275} width={105} height={42} color="text-orange-400" />
                        <text x="312" y="302" textAnchor="middle" className="fill-orange-400 text-[12px]">
                            Gemini
                        </text>
                    </g>

                    {/* Lines: Providers → Response (converging) */}
                    <path
                        d="M 67 317 L 140 355"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>
                    <path
                        d="M 190 317 L 190 355"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>
                    <path
                        d="M 312 317 L 240 355"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        className="text-muted-foreground/40"
                        fill="none"
                    >
                        <animate
                            attributeName="stroke-dashoffset"
                            values="0;-20"
                            dur="1s"
                            repeatCount="indefinite"
                        />
                    </path>

                    {/* Response Node */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect
                            x="115" y="355" width="150" height="50" rx="4"
                            className="fill-blue-400/5 stroke-blue-400/60"
                            strokeWidth="1.5"
                            strokeDasharray="8 4"
                        />
                        <CornerDots x={115} y={355} width={150} height={50} color="text-blue-400" />
                        <text x="190" y="385" textAnchor="middle" className="fill-blue-400 text-[14px] font-medium">
                            Response
                        </text>
                    </g>
                </svg>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-3 pt-3 border-t border-border/30">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className="text-emerald-400">✓</span> Zero vendor lock-in
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className="text-emerald-400">✓</span> Auto-retry & failover
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className="text-emerald-400">✓</span> OpenAI-compatible
                </span>
            </div>
        </BentoCard>
    );
};
