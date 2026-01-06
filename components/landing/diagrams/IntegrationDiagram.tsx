"use client";

import React from "react";
import {
    OpenAI, Claude, Gemini, Aws,
    Github, Cloudflare, Azure, Meta, Groq, XAI
} from "@lobehub/icons";
import { VercelLogo, SupabaseLogo } from "@/components/icons/BrandIcons";

/**
 * Integration Diagram - True Infrastructure Feel
 * User Requests → Cencori → AI Providers + Cloud/Edge + Storage
 * Providers and Cloud grouped in container boxes
 */
export const IntegrationDiagram = () => {
    // Corner dots
    const CornerDots = ({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) => (
        <g className={color}>
            <circle cx={x} cy={y} r="2.5" fill="currentColor" />
            <circle cx={x + width} cy={y} r="2.5" fill="currentColor" />
            <circle cx={x} cy={y + height} r="2.5" fill="currentColor" />
            <circle cx={x + width} cy={y + height} r="2.5" fill="currentColor" />
        </g>
    );

    const AnimatedPath = ({ d, color = "text-muted-foreground/40" }: { d: string; color?: string }) => (
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className={color} fill="none">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
        </path>
    );

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">Integration</h3>
                <p className="text-muted-foreground text-sm md:text-base">
                    Connect to any AI provider, deploy anywhere, and integrate with your stack.
                </p>
            </div>

            {/* Desktop */}
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[480px]">
                <svg viewBox="0 0 960 460" className="w-full h-full" fill="none" preserveAspectRatio="xMidYMid meet">

                    {/* ==================== TOP: User Requests ==================== */}
                    <g className="animate-fade-in">
                        <rect x="380" y="15" width="200" height="45" rx="6" className="fill-violet-400/10 stroke-violet-400/50" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={380} y={15} width={200} height={45} color="text-violet-400" />
                        <text x="480" y="44" textAnchor="middle" className="fill-violet-400 text-[13px] font-medium">User Requests</text>
                    </g>

                    {/* User → Cencori Path */}
                    <AnimatedPath d="M 480 60 L 480 155" color="text-violet-400/50" />

                    {/* ==================== CENTER: Cencori Hub ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="445" y="155" width="70" height="70" rx="6" className="fill-background stroke-foreground/40" strokeWidth="2" strokeDasharray="8 4" />
                        <CornerDots x={445} y={155} width={70} height={70} color="text-foreground/60" />
                        <image href="/cdark.png" x="460" y="170" width="40" height="40" className="hidden dark:block" />
                        <image href="/clight.png" x="460" y="170" width="40" height="40" className="block dark:hidden" />
                    </g>

                    {/* ==================== LEFT: AI Providers Container ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        {/* Container box - styled like storage boxes */}
                        <rect x="30" y="100" width="180" height="150" rx="6" className="fill-indigo-400/5 stroke-indigo-400/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={30} y={100} width={180} height={150} color="text-indigo-400" />
                        <text x="120" y="118" textAnchor="middle" className="fill-indigo-400 text-[10px] font-medium uppercase tracking-wide">AI Providers</text>

                        {/* Provider icons - 2x3 grid, centered */}
                        {/* Row 1 */}
                        <rect x="43" y="128" width="44" height="44" rx="4" className="fill-emerald-400/10 stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={43} y={128} width={44} height={44} color="text-emerald-400" />
                        <foreignObject x="53" y="138" width="24" height="24"><OpenAI size={24} className="text-emerald-400" /></foreignObject>

                        <rect x="98" y="128" width="44" height="44" rx="4" className="fill-orange-400/10 stroke-orange-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={98} y={128} width={44} height={44} color="text-orange-400" />
                        <foreignObject x="108" y="138" width="24" height="24"><Claude size={24} className="text-orange-400" /></foreignObject>

                        <rect x="153" y="128" width="44" height="44" rx="4" className="fill-blue-400/10 stroke-blue-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={153} y={128} width={44} height={44} color="text-blue-400" />
                        <foreignObject x="163" y="138" width="24" height="24"><Gemini size={24} className="text-blue-400" /></foreignObject>

                        {/* Row 2 */}
                        <rect x="43" y="183" width="44" height="44" rx="4" className="fill-purple-400/10 stroke-purple-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={43} y={183} width={44} height={44} color="text-purple-400" />
                        <foreignObject x="53" y="193" width="24" height="24"><Meta size={24} className="text-purple-400" /></foreignObject>

                        <rect x="98" y="183" width="44" height="44" rx="4" className="fill-cyan-400/10 stroke-cyan-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={98} y={183} width={44} height={44} color="text-cyan-400" />
                        <foreignObject x="108" y="193" width="24" height="24"><Groq size={24} className="text-cyan-400" /></foreignObject>

                        <rect x="153" y="183" width="44" height="44" rx="4" className="fill-foreground/10 stroke-foreground/40" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={153} y={183} width={44} height={44} color="text-foreground/60" />
                        <foreignObject x="163" y="193" width="24" height="24"><XAI size={24} /></foreignObject>

                        {/* More indicator */}
                        <text x="120" y="242" textAnchor="middle" className="fill-indigo-400/60 text-[10px]">+ more</text>
                    </g>

                    {/* Providers → Cencori (single collector line) */}
                    <AnimatedPath d="M 210 190 L 280 190 L 280 190 L 445 190" color="text-muted-foreground/40" />

                    {/* ==================== RIGHT: Cloud & Edge Container ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        {/* Container box - styled like storage boxes */}
                        <rect x="750" y="100" width="180" height="150" rx="6" className="fill-amber-400/5 stroke-amber-400/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={750} y={100} width={180} height={150} color="text-amber-400" />
                        <text x="840" y="118" textAnchor="middle" className="fill-amber-400 text-[10px] font-medium uppercase tracking-wide">Cloud & Edge</text>

                        {/* Cloud icons - 2x3 grid, centered */}
                        {/* Row 1 */}
                        <rect x="763" y="128" width="44" height="44" rx="4" className="fill-amber-400/10 stroke-amber-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={763} y={128} width={44} height={44} color="text-amber-400" />
                        <foreignObject x="773" y="138" width="24" height="24"><Aws size={24} className="text-amber-400" /></foreignObject>

                        <rect x="818" y="128" width="44" height="44" rx="4" className="fill-sky-400/10 stroke-sky-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={818} y={128} width={44} height={44} color="text-sky-400" />
                        <foreignObject x="828" y="138" width="24" height="24"><Azure size={24} className="text-sky-400" /></foreignObject>

                        <rect x="873" y="128" width="44" height="44" rx="4" className="fill-orange-500/10 stroke-orange-500/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={873} y={128} width={44} height={44} color="text-orange-500" />
                        <foreignObject x="883" y="138" width="24" height="24"><Cloudflare size={24} className="text-orange-500" /></foreignObject>

                        {/* Row 2 */}
                        <rect x="763" y="183" width="44" height="44" rx="4" className="fill-foreground/5 stroke-foreground/30" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={763} y={183} width={44} height={44} color="text-foreground/50" />
                        <foreignObject x="773" y="193" width="24" height="24"><VercelLogo className="w-5 h-5" /></foreignObject>

                        <rect x="818" y="183" width="44" height="44" rx="4" className="fill-emerald-400/10 stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={818} y={183} width={44} height={44} color="text-emerald-400" />
                        <foreignObject x="828" y="193" width="24" height="24"><SupabaseLogo className="w-5 h-5" /></foreignObject>

                        <rect x="873" y="183" width="44" height="44" rx="4" className="fill-foreground/5 stroke-foreground/30" strokeWidth="1.5" strokeDasharray="5 3" />
                        <CornerDots x={873} y={183} width={44} height={44} color="text-foreground/50" />
                        <foreignObject x="883" y="193" width="24" height="24"><Github size={22} /></foreignObject>

                        {/* More indicator */}
                        <text x="840" y="242" textAnchor="middle" className="fill-amber-400/60 text-[10px]">+ more</text>
                    </g>

                    {/* Cencori → Cloud/Edge (single collector line) */}
                    <AnimatedPath d="M 515 190 L 680 190 L 680 190 L 750 190" color="text-muted-foreground/40" />

                    {/* ==================== BOTTOM: Storage Layer ==================== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <rect x="340" y="320" width="80" height="40" rx="4" className="fill-purple-400/10 stroke-purple-400/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={340} y={320} width={80} height={40} color="text-purple-400" />
                        <text x="380" y="345" textAnchor="middle" className="fill-purple-400 text-[11px] font-medium">Vector</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.55s" }}>
                        <rect x="440" y="320" width="80" height="40" rx="4" className="fill-cyan-400/10 stroke-cyan-400/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={440} y={320} width={80} height={40} color="text-cyan-400" />
                        <text x="480" y="345" textAnchor="middle" className="fill-cyan-400 text-[11px] font-medium">Cache</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.6s" }}>
                        <rect x="540" y="320" width="80" height="40" rx="4" className="fill-pink-400/10 stroke-pink-400/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={540} y={320} width={80} height={40} color="text-pink-400" />
                        <text x="580" y="345" textAnchor="middle" className="fill-pink-400 text-[11px] font-medium">Edge</text>
                    </g>

                    {/* Cencori → Storage */}
                    <AnimatedPath d="M 465 225 L 465 285 L 380 285 L 380 320" color="text-purple-400/40" />
                    <AnimatedPath d="M 480 225 L 480 320" color="text-cyan-400/40" />
                    <AnimatedPath d="M 495 225 L 495 285 L 580 285 L 580 320" color="text-pink-400/40" />

                    {/* Storage label */}
                    <text x="480" y="390" textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase tracking-wide">Storage</text>

                </svg>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex flex-col items-center">
                <svg viewBox="0 0 300 400" className="w-full max-w-[300px] h-auto" fill="none" preserveAspectRatio="xMidYMid meet">

                    {/* User Requests */}
                    <g className="animate-fade-in">
                        <rect x="85" y="10" width="130" height="35" rx="4" className="fill-violet-400/10 stroke-violet-400/50" strokeWidth="1.5" strokeDasharray="6 3" />
                        <text x="150" y="33" textAnchor="middle" className="fill-violet-400 text-[11px] font-medium">User Requests</text>
                    </g>

                    <AnimatedPath d="M 150 45 L 150 65" color="text-violet-400/50" />

                    {/* Cencori */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="110" y="65" width="80" height="80" rx="6" className="fill-background stroke-foreground/40" strokeWidth="1.5" strokeDasharray="6 3" />
                        <image href="/cdark.png" x="125" y="80" width="50" height="50" className="hidden dark:block" />
                        <image href="/clight.png" x="125" y="80" width="50" height="50" className="block dark:hidden" />
                    </g>

                    <AnimatedPath d="M 150 145 L 150 160" color="text-muted-foreground/40" />

                    {/* AI Providers Container */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect x="15" y="160" width="130" height="75" rx="6" className="fill-transparent stroke-muted-foreground/20" strokeWidth="1" strokeDasharray="3 3" />
                        <text x="80" y="175" textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase tracking-wide">Providers</text>

                        {/* 3 icons in row */}
                        <rect x="25" y="185" width="32" height="32" rx="3" className="fill-emerald-400/10 stroke-emerald-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="29" y="189" width="24" height="24"><OpenAI size={24} className="text-emerald-400" /></foreignObject>

                        <rect x="65" y="185" width="32" height="32" rx="3" className="fill-orange-400/10 stroke-orange-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="69" y="189" width="24" height="24"><Claude size={24} className="text-orange-400" /></foreignObject>

                        <rect x="105" y="185" width="32" height="32" rx="3" className="fill-blue-400/10 stroke-blue-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="109" y="189" width="24" height="24"><Gemini size={24} className="text-blue-400" /></foreignObject>
                    </g>

                    {/* Cloud & Edge Container */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="155" y="160" width="130" height="75" rx="6" className="fill-transparent stroke-muted-foreground/20" strokeWidth="1" strokeDasharray="3 3" />
                        <text x="220" y="175" textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase tracking-wide">Cloud & Edge</text>

                        {/* 3 icons in row */}
                        <rect x="165" y="185" width="32" height="32" rx="3" className="fill-amber-400/10 stroke-amber-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="169" y="189" width="24" height="24"><Aws size={24} className="text-amber-400" /></foreignObject>

                        <rect x="205" y="185" width="32" height="32" rx="3" className="fill-sky-400/10 stroke-sky-400/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="209" y="189" width="24" height="24"><Azure size={24} className="text-sky-400" /></foreignObject>

                        <rect x="245" y="185" width="32" height="32" rx="3" className="fill-orange-500/10 stroke-orange-500/50" strokeWidth="1" strokeDasharray="4 2" />
                        <foreignObject x="249" y="189" width="24" height="24"><Cloudflare size={24} className="text-orange-500" /></foreignObject>
                    </g>

                    <AnimatedPath d="M 150 235 L 150 260" color="text-muted-foreground/40" />

                    {/* Storage Row */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="35" y="260" width="70" height="32" rx="4" className="fill-purple-400/10 stroke-purple-400/40" strokeWidth="1" strokeDasharray="4 2" />
                        <text x="70" y="281" textAnchor="middle" className="fill-purple-400 text-[10px] font-medium">Vector</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.45s" }}>
                        <rect x="115" y="260" width="70" height="32" rx="4" className="fill-cyan-400/10 stroke-cyan-400/40" strokeWidth="1" strokeDasharray="4 2" />
                        <text x="150" y="281" textAnchor="middle" className="fill-cyan-400 text-[10px] font-medium">Cache</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <rect x="195" y="260" width="70" height="32" rx="4" className="fill-pink-400/10 stroke-pink-400/40" strokeWidth="1" strokeDasharray="4 2" />
                        <text x="230" y="281" textAnchor="middle" className="fill-pink-400 text-[10px] font-medium">Edge</text>
                    </g>

                    <text x="150" y="315" textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase tracking-wide">Storage</text>
                </svg>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/30 -mx-8 px-8">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Single API
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Multi-cloud
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Edge deploy
                </span>
            </div>
        </div>
    );
};
