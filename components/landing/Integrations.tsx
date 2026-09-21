"use client";

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Cpu } from 'lucide-react';
import { OpenAI, Claude, Gemini } from '@lobehub/icons';

interface ProviderItemProps {
    name: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    borderColor: string;
    bg: string;
}

interface ConnectionPathProps {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    delay: number;
}

export const Integrations = () => {
    return (
        <section className="relative overflow-hidden bg-background">
            <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 sm:px-12 sm:py-28">
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
                            <img src="/logo white.svg" alt="Cencori" className="w-10 h-auto hidden dark:block" />
                            <img src="/logo black.svg" alt="Cencori" className="w-10 h-auto block dark:hidden" />
                        </div>
                    </div>

                    {/* Left Point (Client Application) */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
                        <ClientApplicationNode />
                    </div>

                    {/* Right Points (Providers) */}
                    <div className="absolute right-0 top-0 bottom-0 flex w-48 flex-col justify-between py-4 z-20">
                        <ProviderItem name="OpenAI" Icon={OpenAI} color="text-emerald-500" borderColor="border-emerald-500/20" bg="bg-emerald-500/10" />
                        <ProviderItem name="Anthropic" Icon={Claude} color="text-orange-500" borderColor="border-orange-500/20" bg="bg-orange-500/10" />
                        <ProviderItem name="Gemini" Icon={Gemini} color="text-blue-500" borderColor="border-blue-500/20" bg="bg-blue-500/10" />
                        <ProviderItem name="Custom" Icon={Cpu} color="text-yellow-500" borderColor="border-yellow-500/20" bg="bg-yellow-500/10" />
                    </div>

                    {/* Client -> Cencori. The responsive inset keeps both ends attached as the layout narrows. */}
                    <div className="pointer-events-none absolute left-[238px] right-[calc(50%+2.5rem)] top-1/2 z-10 h-px bg-foreground/[0.14]">
                        <motion.span
                            className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                            animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                    </div>

                    {/* Cencori -> Providers. This region stretches between the two node edges. */}
                    <ProviderConnections />
                </div>

                {/* Mobile Flow Visualization (Vertical) */}
                <div className="relative w-full max-w-sm mx-auto h-[620px] md:hidden block">
                    {/* Top Point (Client Application) */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                        <ClientApplicationNode compact />
                    </div>

                    {/* Center Point (Cencori) */}
                    <div className="absolute top-[240px] left-1/2 -translate-x-1/2 z-20">
                        <div className="w-20 h-20 rounded-2xl bg-background border border-border shadow-lg flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-foreground/5 rounded-2xl" />
                            <img src="/logo white.svg" alt="Cencori" className="w-10 h-auto hidden dark:block" />
                            <img src="/logo black.svg" alt="Cencori" className="w-10 h-auto block dark:hidden" />
                        </div>
                    </div>

                    {/* Bottom Points (Providers) - Horizontal Stack */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between gap-2 z-20 px-2">
                        <ProviderItemMobileIconOnly name="OpenAI" Icon={OpenAI} color="text-emerald-500" borderColor="border-emerald-500/20" bg="bg-emerald-500/10" />
                        <ProviderItemMobileIconOnly name="Anthropic" Icon={Claude} color="text-orange-500" borderColor="border-orange-500/20" bg="bg-orange-500/10" />
                        <ProviderItemMobileIconOnly name="Gemini" Icon={Gemini} color="text-blue-500" borderColor="border-blue-500/20" bg="bg-blue-500/10" />
                        <ProviderItemMobileIconOnly name="Custom" Icon={Cpu} color="text-yellow-500" borderColor="border-yellow-500/20" bg="bg-yellow-500/10" />
                    </div>

                    {/* SVG Connections (Vertical) */}
                    <svg
                        className="absolute inset-0 z-10 h-full w-full overflow-visible pointer-events-none"
                        viewBox="0 0 360 620"
                        preserveAspectRatio="none"
                    >
                        {/* Line: Client -> Cencori */}
                        <path d="M 180 192 L 180 240" stroke="currentColor" strokeOpacity="0.14" fill="none" strokeWidth="1" />

                        {/* Animated Packet: Client -> Cencori */}
                        <motion.circle
                            r="3"
                            fill="currentColor"
                            animate={{ cy: [192, 240], opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            cx="180"
                        />

                        {/* Lines: Cencori -> Providers */}
                        {/* OpenAI */}
                        <ConnectionPathVerticalMobile startX={180} startY={320} endX={48} endY={575} color="#10b981" delay={0} />

                        {/* Anthropic */}
                        <ConnectionPathVerticalMobile startX={180} startY={320} endX={136} endY={575} color="#f97316" delay={0.5} />

                        {/* Gemini */}
                        <ConnectionPathVerticalMobile startX={180} startY={320} endX={224} endY={575} color="#3b82f6" delay={1} />

                        {/* Custom */}
                        <ConnectionPathVerticalMobile startX={180} startY={320} endX={312} endY={575} color="#eab308" delay={1.5} />
                    </svg>
                </div>

            </div>
        </section>
    );
};

const ClientApplicationNode = ({ compact = false }: { compact?: boolean }) => (
    <div
        aria-label="Client application sending an AI request"
        className={cn(
            "relative overflow-hidden border border-border/80 bg-background/90 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm",
            compact ? "h-48 w-60 rounded-[18px] p-4" : "h-[244px] w-[238px] rounded-[22px] p-5",
        )}
        role="img"
    >
        <div className="relative z-10">
            <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-[#ff5f57] shadow-[0_0_10px_rgba(255,95,87,0.28)]" />
                <span className="size-2.5 rounded-full bg-[#febc2e] shadow-[0_0_10px_rgba(254,188,46,0.24)]" />
                <span className="size-2.5 rounded-full bg-[#28c840] shadow-[0_0_10px_rgba(40,200,64,0.24)]" />
            </div>

            <div className={cn("font-medium tracking-[-0.035em] text-foreground/32", compact ? "mt-3 text-xl" : "mt-5 text-2xl")}>
                AI App
            </div>

            <div className={cn("space-y-2", compact ? "mt-2.5" : "mt-4")} aria-hidden="true">
                <div className="h-2.5 w-[82%] rounded-full bg-foreground/[0.14]" />
                <div className="h-2.5 w-[64%] rounded-full bg-foreground/[0.11]" />
            </div>

            <div
                aria-hidden="true"
                className={cn(
                    "relative overflow-hidden rounded-lg border border-foreground/[0.04] bg-foreground/[0.08]",
                    compact ? "mt-3 h-12" : "mt-4 h-16",
                )}
            >
                <div className="absolute inset-x-3 top-3 h-1.5 w-2/5 rounded-full bg-foreground/[0.08]" />
            </div>

            {!compact ? (
                <div className="mt-4 h-2 w-[72%] rounded-full bg-foreground/[0.08]" aria-hidden="true" />
            ) : null}
        </div>
    </div>
);

const ProviderItem = ({ name, Icon, color, borderColor, bg }: ProviderItemProps) => (
    <div className={cn("flex items-center gap-3 p-3 pl-4 rounded-xl border bg-background/50 backdrop-blur-sm transition-all hover:scale-105 w-48", borderColor, bg)}>
        <Icon size={24} className={color} />
        <span className={cn("font-medium text-sm", color)}>{name}</span>
    </div>
);

const ProviderItemMobileIconOnly = ({ name, Icon, color, borderColor, bg }: ProviderItemProps) => (
    <div
        className={cn("flex items-center justify-center p-3 rounded-xl border bg-background/50 backdrop-blur-sm w-full aspect-square", borderColor, bg)}
        title={name}
        aria-label={name}
    >
        <Icon size={28} className={color} />
    </div>
);

const ProviderConnections = () => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState(0);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateWidth = () => {
            const nextWidth = container.getBoundingClientRect().width;
            setWidth((currentWidth) => Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth);
        };

        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(container);

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className="pointer-events-none absolute inset-y-0 left-[calc(50%+2.5rem)] right-48 z-10"
            aria-hidden="true"
        >
            {width > 0 ? (
                <svg
                    className="h-full w-full overflow-visible"
                    viewBox={`0 0 ${width} 400`}
                    preserveAspectRatio="none"
                >
                    <ConnectionPath startX={0} startY={200} endX={width} endY={40} color="#10b981" delay={0} />
                    <ConnectionPath startX={0} startY={200} endX={width} endY={146} color="#f97316" delay={0.5} />
                    <ConnectionPath startX={0} startY={200} endX={width} endY={253} color="#3b82f6" delay={1} />
                    <ConnectionPath startX={0} startY={200} endX={width} endY={360} color="#eab308" delay={1.5} />
                </svg>
            ) : null}
        </div>
    );
};

const ConnectionPath = ({ startX, startY, endX, endY, color, delay }: ConnectionPathProps) => {
    // Bezier curve for smooth flow
    const midX = (startX + endX) / 2;
    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

    return (
        <>
            <path d={path} stroke={color} strokeOpacity="0.2" fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke" />
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

const ConnectionPathVerticalMobile = ({ startX, startY, endX, endY, color, delay }: ConnectionPathProps) => {
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
