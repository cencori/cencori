"use client";

import React from "react";
import { useTheme } from "next-themes";
import { OpenAI, Claude, Gemini, Meta, Groq, XAI, Aws, Azure, Cloudflare, Github } from "@lobehub/icons";
import { VercelLogo, SupabaseLogo } from "@/components/icons/BrandIcons";

/**
 * Integration Diagram - Brand icons layout
 * Shows: User → Cencori Hub → AI Providers / Cloud & Edge / Storage
 */
export const IntegrationDiagram = () => {
    const { resolvedTheme } = useTheme();

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

    // Animated path with optional color
    const AnimatedPath = ({ d, color = "text-muted-foreground/40" }: { d: string; color?: string }) => (
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className={color} fill="none">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
        </path>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">Integration</h3>
                <p className="text-muted-foreground text-sm md:text-base">
                    Connect to any AI provider, deploy anywhere, and integrate with your stack.
                </p>
            </div>

            {/* ==================== DESKTOP ==================== */}
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[450px]">
                <svg
                    viewBox="0 0 960 480"
                    className="w-full h-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* ==================== TOP: User Requests ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <rect x="405" y="20" width="150" height="40" rx="4" className="fill-violet-400/10 stroke-violet-400/50" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={405} y={20} width={150} height={40} color="text-violet-400" />
                        <text x="480" y="46" textAnchor="middle" className="fill-violet-400 text-[14px] font-medium">User Requests</text>
                    </g>

                    {/* User → Cencori */}
                    <AnimatedPath d="M 480 60 L 480 155" color="text-violet-400/50" />

                    {/* ==================== CENTER: Cencori Hub ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="445" y="155" width="70" height="70" rx="8" className="fill-foreground/5 stroke-foreground/30" strokeWidth="2" strokeDasharray="8 4" />
                        <CornerDots x={445} y={155} width={70} height={70} color="text-foreground/60" />
                        <image
                            href={resolvedTheme === "dark" ? "/cdark.png" : "/clight.png"}
                            x="460" y="170" width="40" height="40"
                        />
                    </g>

                    {/* Providers → Cencori */}
                    <AnimatedPath d="M 230 190 L 280 190 L 280 190 L 445 190" color="text-indigo-400/50" />

                    {/* ==================== LEFT: AI Providers Container ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        {/* Container box - styled like storage boxes */}
                        <rect x="20" y="90" width="210" height="175" rx="6" className="fill-indigo-400/5 stroke-indigo-400/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={20} y={90} width={210} height={175} color="text-indigo-400" />
                        <text x="125" y="110" textAnchor="middle" className="fill-indigo-400 text-[10px] font-medium uppercase tracking-wide">Providers</text>

                        {/* Provider icons - 2x3 grid, centered */}
                        {/* Row 1 */}
                        <rect x="35" y="120" width="52" height="52" rx="4" className="fill-emerald-400/10 stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={35} y={120} width={52} height={52} color="text-emerald-400" />
                        <foreignObject x="44" y="129" width="34" height="34"><OpenAI size={34} className="text-emerald-400" /></foreignObject>

                        <rect x="99" y="120" width="52" height="52" rx="4" className="fill-orange-400/10 stroke-orange-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={99} y={120} width={52} height={52} color="text-orange-400" />
                        <foreignObject x="108" y="129" width="34" height="34"><Claude size={34} className="text-orange-400" /></foreignObject>

                        <rect x="163" y="120" width="52" height="52" rx="4" className="fill-blue-400/10 stroke-blue-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={163} y={120} width={52} height={52} color="text-blue-400" />
                        <foreignObject x="172" y="129" width="34" height="34"><Gemini size={34} className="text-blue-400" /></foreignObject>

                        {/* Row 2 */}
                        <rect x="35" y="185" width="52" height="52" rx="4" className="fill-purple-400/10 stroke-purple-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={35} y={185} width={52} height={52} color="text-purple-400" />
                        <foreignObject x="44" y="194" width="34" height="34"><Meta size={34} className="text-purple-400" /></foreignObject>

                        <rect x="99" y="185" width="52" height="52" rx="4" className="fill-cyan-400/10 stroke-cyan-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={99} y={185} width={52} height={52} color="text-cyan-400" />
                        <foreignObject x="108" y="194" width="34" height="34"><Groq size={34} className="text-cyan-400" /></foreignObject>

                        <rect x="163" y="185" width="52" height="52" rx="4" className="fill-foreground/10 stroke-foreground/40" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={163} y={185} width={52} height={52} color="text-foreground/60" />
                        <foreignObject x="172" y="194" width="34" height="34"><XAI size={34} /></foreignObject>

                        {/* More indicator */}
                        <text x="125" y="258" textAnchor="middle" className="fill-indigo-400/60 text-[10px]">+ more</text>
                    </g>

                    {/* ==================== RIGHT: Cloud & Edge Container ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        {/* Container box - styled like storage boxes */}
                        <rect x="730" y="90" width="210" height="175" rx="6" className="fill-amber-400/5 stroke-amber-400/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={730} y={90} width={210} height={175} color="text-amber-400" />
                        <text x="835" y="110" textAnchor="middle" className="fill-amber-400 text-[10px] font-medium uppercase tracking-wide">Cloud & Edge</text>

                        {/* Cloud icons - 2x3 grid, centered */}
                        {/* Row 1 */}
                        <rect x="745" y="120" width="52" height="52" rx="4" className="fill-amber-400/10 stroke-amber-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={745} y={120} width={52} height={52} color="text-amber-400" />
                        <foreignObject x="754" y="129" width="34" height="34"><Aws size={34} className="text-amber-400" /></foreignObject>

                        <rect x="809" y="120" width="52" height="52" rx="4" className="fill-sky-400/10 stroke-sky-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={809} y={120} width={52} height={52} color="text-sky-400" />
                        <foreignObject x="818" y="129" width="34" height="34"><Azure size={34} className="text-sky-400" /></foreignObject>

                        <rect x="873" y="120" width="52" height="52" rx="4" className="fill-orange-500/10 stroke-orange-500/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={873} y={120} width={52} height={52} color="text-orange-500" />
                        <foreignObject x="882" y="129" width="34" height="34"><Cloudflare size={34} className="text-orange-500" /></foreignObject>

                        {/* Row 2 */}
                        <rect x="745" y="185" width="52" height="52" rx="4" className="fill-foreground/5 stroke-foreground/30" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={745} y={185} width={52} height={52} color="text-foreground/50" />
                        <foreignObject x="754" y="194" width="34" height="34"><VercelLogo className="w-7 h-7" /></foreignObject>

                        <rect x="809" y="185" width="52" height="52" rx="4" className="fill-emerald-400/10 stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={809} y={185} width={52} height={52} color="text-emerald-400" />
                        <foreignObject x="818" y="194" width="34" height="34"><SupabaseLogo className="w-7 h-7" /></foreignObject>

                        <rect x="873" y="185" width="52" height="52" rx="4" className="fill-foreground/5 stroke-foreground/30" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={873} y={185} width={52} height={52} color="text-foreground/50" />
                        <foreignObject x="882" y="194" width="34" height="34"><Github size={32} /></foreignObject>

                        {/* More indicator */}
                        <text x="835" y="258" textAnchor="middle" className="fill-amber-400/60 text-[10px]">+ more</text>
                    </g>

                    {/* Cencori → Cloud/Edge (single collector line) */}
                    <AnimatedPath d="M 515 190 L 650 190 L 650 190 L 730 190" color="text-amber-400/50" />

                    {/* ==================== BOTTOM: Storage Layer ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        {/* Storage label */}
                        <text x="480" y="430" textAnchor="middle" className="fill-muted-foreground/50 text-[10px] uppercase tracking-widest">Storage</text>

                        {/* Vector DB */}
                        <rect x="335" y="320" width="90" height="90" rx="4" className="fill-teal-400/10 stroke-teal-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={335} y={320} width={90} height={90} color="text-teal-400" />
                        <text x="380" y="370" textAnchor="middle" className="fill-teal-400 text-[13px] font-medium">Vector</text>

                        {/* Cache */}
                        <rect x="435" y="320" width="90" height="90" rx="4" className="fill-pink-400/10 stroke-pink-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={435} y={320} width={90} height={90} color="text-pink-400" />
                        <text x="480" y="370" textAnchor="middle" className="fill-pink-400 text-[13px] font-medium">Cache</text>

                        {/* Edge Storage */}
                        <rect x="535" y="320" width="90" height="90" rx="4" className="fill-cyan-400/10 stroke-cyan-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={535} y={320} width={90} height={90} color="text-cyan-400" />
                        <text x="580" y="370" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Edge</text>
                    </g>

                    {/* Cencori → Storage paths */}
                    <AnimatedPath d="M 465 225 L 465 285 L 380 285 L 380 320" color="text-teal-400/50" />
                    <AnimatedPath d="M 480 225 L 480 320" color="text-pink-400/50" />
                    <AnimatedPath d="M 495 225 L 495 285 L 580 285 L 580 320" color="text-cyan-400/50" />
                </svg>
            </div>

            {/* ==================== MOBILE ==================== */}
            <div className="md:hidden flex flex-col items-center">
                <svg
                    viewBox="0 0 280 380"
                    className="w-full max-w-[280px] h-auto"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* User Requests */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <rect x="90" y="10" width="100" height="35" rx="4" className="fill-violet-400/10 stroke-violet-400/50" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={90} y={10} width={100} height={35} color="text-violet-400" />
                        <text x="140" y="32" textAnchor="middle" className="fill-violet-400 text-[11px] font-medium">User Requests</text>
                    </g>

                    <AnimatedPath d="M 140 45 L 140 65" />

                    {/* Cencori Hub */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="110" y="65" width="60" height="60" rx="6" className="fill-foreground/5 stroke-foreground/30" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={110} y={65} width={60} height={60} color="text-foreground/50" />
                        <image
                            href={resolvedTheme === "dark" ? "/cdark.png" : "/clight.png"}
                            x="120" y="75" width="40" height="40"
                        />
                    </g>

                    <AnimatedPath d="M 140 125 L 140 150" />

                    {/* Providers Label */}
                    <text x="140" y="165" textAnchor="middle" className="fill-indigo-400/80 text-[9px] uppercase tracking-wide">Providers & Deploy</text>

                    {/* Provider icons row */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="25" y="175" width="36" height="36" rx="3" className="fill-emerald-400/10 stroke-emerald-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="29" y="179" width="28" height="28"><OpenAI size={28} className="text-emerald-400" /></foreignObject>

                        <rect x="68" y="175" width="36" height="36" rx="3" className="fill-orange-400/10 stroke-orange-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="72" y="179" width="28" height="28"><Claude size={28} className="text-orange-400" /></foreignObject>

                        <rect x="111" y="175" width="36" height="36" rx="3" className="fill-blue-400/10 stroke-blue-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="115" y="179" width="28" height="28"><Gemini size={28} className="text-blue-400" /></foreignObject>

                        <rect x="154" y="175" width="36" height="36" rx="3" className="fill-amber-400/10 stroke-amber-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="158" y="179" width="28" height="28"><Aws size={28} className="text-amber-400" /></foreignObject>

                        <rect x="197" y="175" width="36" height="36" rx="3" className="fill-sky-400/10 stroke-sky-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="201" y="179" width="28" height="28"><Azure size={28} className="text-sky-400" /></foreignObject>

                        <rect x="240" y="175" width="36" height="36" rx="3" className="fill-foreground/10 stroke-foreground/30" strokeWidth="1" strokeDasharray="4 2" />
                        <text x="258" y="198" textAnchor="middle" className="fill-muted-foreground text-[10px]">+</text>
                    </g>

                    <AnimatedPath d="M 140 220 L 140 250" />

                    {/* Storage */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <text x="140" y="265" textAnchor="middle" className="fill-muted-foreground/60 text-[9px] uppercase tracking-wide">Storage</text>

                        <rect x="30" y="280" width="70" height="55" rx="3" className="fill-teal-400/10 stroke-teal-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={30} y={280} width={70} height={55} color="text-teal-400" />
                        <text x="65" y="312" textAnchor="middle" className="fill-teal-400 text-[11px]">Vector</text>

                        <rect x="105" y="280" width="70" height="55" rx="3" className="fill-pink-400/10 stroke-pink-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={105} y={280} width={70} height={55} color="text-pink-400" />
                        <text x="140" y="312" textAnchor="middle" className="fill-pink-400 text-[11px]">Cache</text>

                        <rect x="180" y="280" width="70" height="55" rx="3" className="fill-cyan-400/10 stroke-cyan-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={180} y={280} width={70} height={55} color="text-cyan-400" />
                        <text x="215" y="312" textAnchor="middle" className="fill-cyan-400 text-[11px]">Edge</text>
                    </g>
                </svg>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/30 -mx-8 px-8">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-teal-400">✓</span> Single API
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-teal-400">✓</span> Multi-cloud
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-teal-400">✓</span> Edge deploy
                </span>
            </div>
        </div>
    );
};
