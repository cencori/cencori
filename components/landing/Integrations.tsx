"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Cpu } from "lucide-react";



export const Integrations = () => {
    return (
        <section className="py-32 bg-background border-b border-border/40 overflow-hidden relative">
            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
                        Universal AI Gateway
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Connect any client to any model with a single, secure API.
                    </p>
                </div>

                {/* Desktop Flow Visualization (Horizontal) */}
                <div className="relative w-full max-w-5xl mx-auto h-[400px] hidden md:block">
                    {/* Center Point (Cencori) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                        <div className="w-20 h-20 rounded-2xl bg-background border border-border shadow-[0_0_30px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)] flex items-center justify-center relative group">
                            <div className="absolute inset-0 bg-foreground/5 rounded-2xl" />
                            <img src="/cdark.png" alt="Cencori" className="w-10 h-auto hidden dark:block" />
                            <img src="/clight.png" alt="Cencori" className="w-10 h-auto block dark:hidden" />
                        </div>
                    </div>

                    {/* Left Point (Client Request) */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
                        <div className="px-6 py-3 rounded-full border border-border bg-background/50 backdrop-blur-sm shadow-sm">
                            <span className="text-sm font-medium">Client Request</span>
                        </div>
                    </div>

                    {/* Right Points (Providers) */}
                    <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-4 z-20 w-40">
                        <ProviderItem name="OpenAI" icon="/providers/openai.svg" color="text-red-500" borderColor="border-red-500/20" bg="bg-red-500/10" />
                        <ProviderItem name="Anthropic" icon="/providers/anthropic.svg" color="text-green-500" borderColor="border-green-500/20" bg="bg-green-500/10" />
                        <ProviderItem name="Gemini" icon="/providers/google.svg" color="text-blue-500" borderColor="border-blue-500/20" bg="bg-blue-500/10" />
                        <ProviderItem name="Custom" icon={Cpu} color="text-yellow-500" borderColor="border-yellow-500/20" bg="bg-yellow-500/10" isIconComponent />
                    </div>

                    {/* SVG Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                        {/* Line: Client -> Cencori */}
                        <path d="M 140 200 L 470 200" stroke="currentColor" strokeOpacity="0.1" fill="none" strokeWidth="1" />

                        {/* Animated Packet: Client -> Cencori */}
                        <motion.circle
                            r="3"
                            fill="currentColor"
                            animate={{ cx: [140, 470], opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            cy="200"
                        />

                        {/* Lines: Cencori -> Providers */}
                        {/* OpenAI (Top) */}
                        <ConnectionPath startX={550} startY={200} endX={850} endY={40} color="#ef4444" delay={0} />

                        {/* Anthropic */}
                        <ConnectionPath startX={550} startY={200} endX={850} endY={146} color="#22c55e" delay={0.5} />

                        {/* Gemini */}
                        <ConnectionPath startX={550} startY={200} endX={850} endY={253} color="#3b82f6" delay={1} />

                        {/* Custom */}
                        <ConnectionPath startX={550} startY={200} endX={850} endY={360} color="#eab308" delay={1.5} />
                    </svg>
                </div>

                {/* Mobile Flow Visualization (Vertical) */}
                <div className="relative w-full max-w-sm mx-auto h-[500px] md:hidden block">
                    {/* Top Point (Client Request) */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                        <div className="px-6 py-3 rounded-full border border-border bg-background/50 backdrop-blur-sm shadow-sm whitespace-nowrap">
                            <span className="text-sm font-medium">Client Request</span>
                        </div>
                    </div>

                    {/* Center Point (Cencori) */}
                    <div className="absolute top-[150px] left-1/2 -translate-x-1/2 z-20">
                        <div className="w-20 h-20 rounded-2xl bg-background border border-border shadow-lg flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-foreground/5 rounded-2xl" />
                            <img src="/cdark.png" alt="Cencori" className="w-10 h-auto hidden dark:block" />
                            <img src="/clight.png" alt="Cencori" className="w-10 h-auto block dark:hidden" />
                        </div>
                    </div>

                    {/* Bottom Points (Providers) - Horizontal Stack */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between gap-2 z-20 px-2">
                        <ProviderItemMobileIconOnly name="OpenAI" icon="/providers/openai.svg" color="text-red-500" borderColor="border-red-500/20" bg="bg-red-500/10" />
                        <ProviderItemMobileIconOnly name="Anthropic" icon="/providers/anthropic.svg" color="text-green-500" borderColor="border-green-500/20" bg="bg-green-500/10" />
                        <ProviderItemMobileIconOnly name="Gemini" icon="/providers/google.svg" color="text-blue-500" borderColor="border-blue-500/20" bg="bg-blue-500/10" />
                        <ProviderItemMobileIconOnly name="Custom" icon={Cpu} color="text-yellow-500" borderColor="border-yellow-500/20" bg="bg-yellow-500/10" isIconComponent />
                    </div>

                    {/* SVG Connections (Vertical) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                        {/* Line: Client -> Cencori */}
                        <path d="M 192 45 L 192 150" stroke="currentColor" strokeOpacity="0.1" fill="none" strokeWidth="1" />

                        {/* Animated Packet: Client -> Cencori */}
                        <motion.circle
                            r="3"
                            fill="currentColor"
                            animate={{ cy: [45, 150], opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            cx="192"
                        />

                        {/* Lines: Cencori -> Providers */}
                        {/* OpenAI */}
                        <ConnectionPathVerticalMobile startX={192} startY={230} endX={45} endY={440} color="#ef4444" delay={0} />

                        {/* Anthropic */}
                        <ConnectionPathVerticalMobile startX={192} startY={230} endX={135} endY={440} color="#22c55e" delay={0.5} />

                        {/* Gemini */}
                        <ConnectionPathVerticalMobile startX={192} startY={230} endX={225} endY={440} color="#3b82f6" delay={1} />

                        {/* Custom */}
                        <ConnectionPathVerticalMobile startX={192} startY={230} endX={315} endY={440} color="#eab308" delay={1.5} />
                    </svg>
                </div>

            </div>
        </section>
    );
};

const ProviderItem = ({ name, icon, color, borderColor, bg, isIconComponent = false }: any) => (
    <div className={cn("flex items-center gap-3 p-3 pl-4 rounded-xl border bg-background/50 backdrop-blur-sm transition-all hover:scale-105 w-48", borderColor, bg)}>
        {isIconComponent ? (
            <div className={cn("w-6 h-6 flex items-center justify-center", color)}>
                {React.createElement(icon, { className: "w-5 h-5" })}
            </div>
        ) : (
            <img src={icon} alt={name} className="w-6 h-6" />
        )}
        <span className={cn("font-medium text-sm", color)}>{name}</span>
    </div>
);

const ProviderItemMobile = ({ name, icon, color, borderColor, bg, isIconComponent = false }: any) => (
    <div className={cn("flex items-center gap-3 p-3 rounded-xl border bg-background/50 backdrop-blur-sm w-full", borderColor, bg)}>
        {isIconComponent ? (
            <div className={cn("w-6 h-6 flex items-center justify-center", color)}>
                {React.createElement(icon, { className: "w-5 h-5" })}
            </div>
        ) : (
            <img src={icon} alt={name} className="w-6 h-6" />
        )}
        <span className={cn("font-medium text-sm", color)}>{name}</span>
    </div>
);

const ProviderItemMobileIconOnly = ({ name, icon, color, borderColor, bg, isIconComponent = false }: any) => (
    <div className={cn("flex items-center justify-center p-3 rounded-xl border bg-background/50 backdrop-blur-sm w-full aspect-square", borderColor, bg)}>
        {isIconComponent ? (
            <div className={cn("w-6 h-6 flex items-center justify-center", color)}>
                {React.createElement(icon, { className: "w-6 h-6" })}
            </div>
        ) : (
            <img src={icon} alt={name} className="w-8 h-8" />
        )}
    </div>
);

const ConnectionPath = ({ startX, startY, endX, endY, color, delay }: any) => {
    // Bezier curve for smooth flow
    const midX = (startX + endX) / 2;
    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

    return (
        <>
            <path d={path} stroke={color} strokeOpacity="0.2" fill="none" strokeWidth="1" />
            <circle r="3" fill={color}>
                <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={path}
                    begin={`${delay}s`}
                />
                <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    dur="2s"
                    repeatCount="indefinite"
                    begin={`${delay}s`}
                />
            </circle>
        </>
    );
};

const ConnectionPathVerticalMobile = ({ startX, startY, endX, endY, color, delay }: any) => {
    // Vertical Bezier curve for mobile
    const midY = (startY + endY) / 2;
    // Curve out then down
    const path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

    return (
        <>
            <path d={path} stroke={color} strokeOpacity="0.2" fill="none" strokeWidth="1" />
            <circle r="3" fill={color}>
                <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={path}
                    begin={`${delay}s`}
                />
                <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    dur="2s"
                    repeatCount="indefinite"
                    begin={`${delay}s`}
                />
            </circle>
        </>
    );
}; 
