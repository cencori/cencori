"use client";

import React from "react";

/**
 * AI Gateway Diagram - Responsive with mobile-optimized layout
 * Desktop: Full 3-column diagram with all nodes
 * Mobile: Simplified core flow + feature badges below
 */
export const AIGatewayDiagram = () => {
    // Reusable corner dots component
    const CornerDots = ({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) => (
        <g className={color}>
            <circle cx={x} cy={y} r="3" fill="currentColor" />
            <circle cx={x + width} cy={y} r="3" fill="currentColor" />
            <circle cx={x} cy={y + height} r="3" fill="currentColor" />
            <circle cx={x + width} cy={y + height} r="3" fill="currentColor" />
        </g>
    );

    // Smaller corner dots for mobile
    const CornerDotsMobile = ({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) => (
        <g className={color}>
            <circle cx={x} cy={y} r="2.5" fill="currentColor" />
            <circle cx={x + width} cy={y} r="2.5" fill="currentColor" />
            <circle cx={x} cy={y + height} r="2.5" fill="currentColor" />
            <circle cx={x + width} cy={y + height} r="2.5" fill="currentColor" />
        </g>
    );

    // Animated path helper
    const AnimatedPath = ({ d }: { d: string }) => (
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className="text-muted-foreground/40" fill="none">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
        </path>
    );

    // Offset for desktop centering
    const X = 50;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">AI Gateway</h3>
                <p className="text-muted-foreground text-sm md:text-base">
                    Unified endpoint for all AI providers with security, routing, and observability built-in.
                </p>
            </div>

            {/* ==================== DESKTOP: Full Diagram ==================== */}
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[450px]">
                <svg
                    viewBox="0 0 900 480"
                    className="w-full h-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* LEFT SIDE: Input Sources */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <rect x={30 + X} y="60" width="120" height="50" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={30 + X} y={60} width={120} height={50} color="text-cyan-400" />
                        <text x={90 + X} y="90" textAnchor="middle" className="fill-cyan-400 text-[14px] font-medium">SDK</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
                        <rect x={30 + X} y="140" width="120" height="50" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={30 + X} y={140} width={120} height={50} color="text-cyan-400" />
                        <text x={90 + X} y="170" textAnchor="middle" className="fill-cyan-400 text-[14px] font-medium">REST API</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x={30 + X} y="220" width="120" height="50" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={30 + X} y={220} width={120} height={50} color="text-cyan-400" />
                        <text x={90 + X} y="250" textAnchor="middle" className="fill-cyan-400 text-[14px] font-medium">Webhooks</text>
                    </g>

                    {/* Lines: Input → Request */}
                    <AnimatedPath d={`M ${150 + X} 85 L ${250 + X} 85 L ${250 + X} 65 L ${320 + X} 65`} />
                    <AnimatedPath d={`M ${150 + X} 165 L ${270 + X} 165 L ${270 + X} 65 L ${320 + X} 65`} />
                    <AnimatedPath d={`M ${150 + X} 245 L ${290 + X} 245 L ${290 + X} 65 L ${320 + X} 65`} />

                    {/* CENTER: Main Flow */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <rect x={320 + X} y="35" width="160" height="60" rx="4" className="fill-blue-400/5 stroke-blue-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDots x={320 + X} y={35} width={160} height={60} color="text-blue-400" />
                        <text x={400 + X} y="72" textAnchor="middle" className="fill-blue-400 text-[16px] font-medium">Request</text>
                    </g>
                    <AnimatedPath d={`M ${400 + X} 95 L ${400 + X} 130`} />
                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect x={290 + X} y="130" width="220" height="70" rx="4" className="fill-emerald-400/5 stroke-emerald-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDots x={290 + X} y={130} width={220} height={70} color="text-emerald-400" />
                        <text x={400 + X} y="162" textAnchor="middle" className="fill-emerald-400 text-[16px] font-medium">Security</text>
                        <text x={400 + X} y="182" textAnchor="middle" className="fill-muted-foreground text-[12px]">PII • Jailbreak • Content Filter</text>
                    </g>
                    <AnimatedPath d={`M ${400 + X} 200 L ${400 + X} 240`} />
                    <g className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
                        <rect x={310 + X} y="240" width="180" height="60" rx="4" className="fill-purple-400/5 stroke-purple-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDots x={310 + X} y={240} width={180} height={60} color="text-purple-400" />
                        <text x={400 + X} y="270" textAnchor="middle" className="fill-purple-400 text-[16px] font-medium">Router</text>
                        <text x={400 + X} y="288" textAnchor="middle" className="fill-muted-foreground text-[12px]">Failover • Load Balance</text>
                    </g>
                    <AnimatedPath d={`M ${350 + X} 300 L ${350 + X} 320 L ${270 + X} 320 L ${270 + X} 340`} />
                    <AnimatedPath d={`M ${400 + X} 300 L ${400 + X} 340`} />
                    <AnimatedPath d={`M ${450 + X} 300 L ${450 + X} 320 L ${530 + X} 320 L ${530 + X} 340`} />
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x={210 + X} y="340" width="120" height="45" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={210 + X} y={340} width={120} height={45} color="text-orange-400" />
                        <text x={270 + X} y="368" textAnchor="middle" className="fill-orange-400 text-[13px]">OpenAI</text>
                        <rect x={340 + X} y="340" width="120" height="45" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={340 + X} y={340} width={120} height={45} color="text-orange-400" />
                        <text x={400 + X} y="368" textAnchor="middle" className="fill-orange-400 text-[13px]">Anthropic</text>
                        <rect x={470 + X} y="340" width="120" height="45" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={470 + X} y={340} width={120} height={45} color="text-orange-400" />
                        <text x={530 + X} y="368" textAnchor="middle" className="fill-orange-400 text-[13px]">Gemini</text>
                    </g>
                    <AnimatedPath d={`M ${270 + X} 385 L ${270 + X} 405 L ${350 + X} 405 L ${350 + X} 420`} />
                    <AnimatedPath d={`M ${400 + X} 385 L ${400 + X} 420`} />
                    <AnimatedPath d={`M ${530 + X} 385 L ${530 + X} 405 L ${450 + X} 405 L ${450 + X} 420`} />
                    <g className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
                        <rect x={320 + X} y="420" width="160" height="60" rx="4" className="fill-blue-400/5 stroke-blue-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDots x={320 + X} y={420} width={160} height={60} color="text-blue-400" />
                        <text x={400 + X} y="457" textAnchor="middle" className="fill-blue-400 text-[16px] font-medium">Response</text>
                    </g>

                    {/* RIGHT SIDE: Observability */}
                    <AnimatedPath d={`M ${510 + X} 145 L ${600 + X} 145 L ${600 + X} 85 L ${650 + X} 85`} />
                    <AnimatedPath d={`M ${510 + X} 165 L ${650 + X} 165`} />
                    <AnimatedPath d={`M ${510 + X} 185 L ${600 + X} 185 L ${600 + X} 245 L ${650 + X} 245`} />
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x={650 + X} y="60" width="120" height="50" rx="4" className="fill-pink-400/5 stroke-pink-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={650 + X} y={60} width={120} height={50} color="text-pink-400" />
                        <text x={710 + X} y="90" textAnchor="middle" className="fill-pink-400 text-[14px] font-medium">Logs</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.45s" }}>
                        <rect x={650 + X} y="140" width="120" height="50" rx="4" className="fill-pink-400/5 stroke-pink-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={650 + X} y={140} width={120} height={50} color="text-pink-400" />
                        <text x={710 + X} y="170" textAnchor="middle" className="fill-pink-400 text-[14px] font-medium">Metrics</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <rect x={650 + X} y="220" width="120" height="50" rx="4" className="fill-pink-400/5 stroke-pink-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={650 + X} y={220} width={120} height={50} color="text-pink-400" />
                        <text x={710 + X} y="250" textAnchor="middle" className="fill-pink-400 text-[14px] font-medium">Alerts</text>
                    </g>
                    <AnimatedPath d={`M ${490 + X} 270 L ${600 + X} 270 L ${600 + X} 325 L ${650 + X} 325`} />
                    <g className="animate-fade-in" style={{ animationDelay: "0.55s" }}>
                        <rect x={650 + X} y="300" width="120" height="50" rx="4" className="fill-amber-400/5 stroke-amber-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={650 + X} y={300} width={120} height={50} color="text-amber-400" />
                        <text x={710 + X} y="330" textAnchor="middle" className="fill-amber-400 text-[14px] font-medium">Cache</text>
                    </g>
                    <AnimatedPath d={`M ${710 + X} 350 L ${710 + X} 450 L ${480 + X} 450`} />
                </svg>
            </div>

            {/* ==================== MOBILE: Simplified Core Flow ==================== */}
            <div className="md:hidden flex flex-col items-center">
                {/* Mobile SVG - Core Flow Only */}
                <svg
                    viewBox="0 0 280 420"
                    className="w-full max-w-[280px] h-auto"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Request */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <rect x="65" y="10" width="150" height="50" rx="4" className="fill-blue-400/5 stroke-blue-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={65} y={10} width={150} height={50} color="text-blue-400" />
                        <text x="140" y="40" textAnchor="middle" className="fill-blue-400 text-[14px] font-medium">Request</text>
                    </g>

                    <AnimatedPath d="M 140 60 L 140 80" />

                    {/* Security */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="40" y="80" width="200" height="60" rx="4" className="fill-emerald-400/5 stroke-emerald-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={40} y={80} width={200} height={60} color="text-emerald-400" />
                        <text x="140" y="108" textAnchor="middle" className="fill-emerald-400 text-[14px] font-medium">Security</text>
                        <text x="140" y="126" textAnchor="middle" className="fill-muted-foreground text-[10px]">PII • Jailbreak • Filter</text>
                    </g>

                    <AnimatedPath d="M 140 140 L 140 160" />

                    {/* Router */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect x="50" y="160" width="180" height="55" rx="4" className="fill-purple-400/5 stroke-purple-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={50} y={160} width={180} height={55} color="text-purple-400" />
                        <text x="140" y="188" textAnchor="middle" className="fill-purple-400 text-[14px] font-medium">Router</text>
                        <text x="140" y="204" textAnchor="middle" className="fill-muted-foreground text-[10px]">Failover • Load Balance</text>
                    </g>

                    <AnimatedPath d="M 80 215 L 80 235 L 55 235 L 55 250" />
                    <AnimatedPath d="M 140 215 L 140 250" />
                    <AnimatedPath d="M 200 215 L 200 235 L 225 235 L 225 250" />

                    {/* Providers */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="10" y="250" width="75" height="38" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={10} y={250} width={75} height={38} color="text-orange-400" />
                        <text x="47" y="274" textAnchor="middle" className="fill-orange-400 text-[11px]">OpenAI</text>

                        <rect x="102" y="250" width="75" height="38" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={102} y={250} width={75} height={38} color="text-orange-400" />
                        <text x="140" y="274" textAnchor="middle" className="fill-orange-400 text-[11px]">Anthropic</text>

                        <rect x="194" y="250" width="75" height="38" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={194} y={250} width={75} height={38} color="text-orange-400" />
                        <text x="232" y="274" textAnchor="middle" className="fill-orange-400 text-[11px]">Gemini</text>
                    </g>

                    <AnimatedPath d="M 47 288 L 47 310 L 100 310 L 100 330" />
                    <AnimatedPath d="M 140 288 L 140 330" />
                    <AnimatedPath d="M 232 288 L 232 310 L 180 310 L 180 330" />

                    {/* Response */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="65" y="330" width="150" height="50" rx="4" className="fill-blue-400/5 stroke-blue-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={65} y={330} width={150} height={50} color="text-blue-400" />
                        <text x="140" y="360" textAnchor="middle" className="fill-blue-400 text-[14px] font-medium">Response</text>
                    </g>
                </svg>
            </div>

            {/* Feature highlights - full width separator */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/30 -mx-8 px-8">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Zero vendor lock-in
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Auto-retry & failover
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> OpenAI-compatible API
                </span>
            </div>
        </div>
    );
};
