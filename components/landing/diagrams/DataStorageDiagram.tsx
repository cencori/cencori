"use client";

import React, { useState } from "react";
import {
    DocumentTextIcon,
    GlobeAltIcon,
    FolderIcon,
    CloudArrowUpIcon,
    CubeIcon,
    CircleStackIcon,
    ServerIcon,
    ArrowPathIcon,
    ChartBarIcon,
    ClockIcon,
    ShieldCheckIcon,
    ArchiveBoxIcon,
} from "@heroicons/react/24/outline";

/**
 * Data Storage Diagram - Icons with hover labels
 * Perfectly centered icons with title reveal on hover
 */
export const DataStorageDiagram = () => {
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    // Corner dots component
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

    // Animated path
    const AnimatedPath = ({ d }: { d: string }) => (
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className="text-muted-foreground/40" fill="none">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
        </path>
    );

    // Icon box with hover label
    const IconBox = ({
        id,
        x,
        y,
        width,
        height,
        icon: Icon,
        label,
        fillColor,
        strokeColor,
        textColor,
    }: {
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        icon: React.ComponentType<{ className?: string }>;
        label: string;
        fillColor: string;
        strokeColor: string;
        textColor: string;
    }) => {
        const isHovered = hoveredNode === id;
        const iconSize = Math.min(width, height) * 0.4;

        return (
            <g
                onMouseEnter={() => setHoveredNode(id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
            >
                {/* Box */}
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="4"
                    className={`${fillColor} ${strokeColor} transition-all duration-200`}
                    strokeWidth={isHovered ? "2" : "1.5"}
                    strokeDasharray="6 3"
                    style={{ filter: isHovered ? 'brightness(1.2)' : undefined }}
                />
                <CornerDots x={x} y={y} width={width} height={height} color={textColor} />

                {/* Centered icon */}
                <foreignObject x={x} y={y} width={width} height={height}>
                    <div className="w-full h-full flex items-center justify-center">
                        <Icon className={`${textColor.replace('text-', 'text-')} transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`} style={{ width: iconSize, height: iconSize }} />
                    </div>
                </foreignObject>

                {/* Hover label */}
                {isHovered && (
                    <g className="animate-fade-in">
                        <rect
                            x={x + width / 2 - label.length * 4}
                            y={y + height + 8}
                            width={label.length * 8 + 16}
                            height="24"
                            rx="4"
                            className="fill-foreground/90"
                        />
                        <text
                            x={x + width / 2}
                            y={y + height + 24}
                            textAnchor="middle"
                            className="fill-background text-[11px] font-medium"
                        >
                            {label}
                        </text>
                    </g>
                )}
            </g>
        );
    };

    // Large icon box with label always visible
    const LargeIconBox = ({
        id,
        x,
        y,
        width,
        height,
        icon: Icon,
        label,
        fillColor,
        strokeColor,
        textColor,
    }: {
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        icon: React.ComponentType<{ className?: string }>;
        label: string;
        fillColor: string;
        strokeColor: string;
        textColor: string;
    }) => {
        const isHovered = hoveredNode === id;

        return (
            <g
                onMouseEnter={() => setHoveredNode(id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
            >
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="4"
                    className={`${fillColor} ${strokeColor} transition-all duration-200`}
                    strokeWidth={isHovered ? "2" : "1.5"}
                    strokeDasharray="8 4"
                    style={{ filter: isHovered ? 'brightness(1.2)' : undefined }}
                />
                <CornerDots x={x} y={y} width={width} height={height} color={textColor} />

                {/* Icon centered in top portion */}
                <foreignObject x={x} y={y + 8} width={width} height={height * 0.55}>
                    <div className="w-full h-full flex items-center justify-center">
                        <Icon className={`${textColor.replace('text-', 'text-')} transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`} style={{ width: 28, height: 28 }} />
                    </div>
                </foreignObject>

                {/* Label */}
                <text
                    x={x + width / 2}
                    y={y + height - 12}
                    textAnchor="middle"
                    className={`${textColor} text-[12px] font-medium`}
                >
                    {label}
                </text>
            </g>
        );
    };

    const X = 50;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">Data Storage</h3>
                <p className="text-muted-foreground text-sm md:text-base">
                    Vector databases, caching, and semantic search for AI-powered applications.
                </p>
            </div>

            {/* ==================== DESKTOP ==================== */}
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[450px]">
                <svg
                    viewBox="0 0 900 520"
                    className="w-full h-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* LEFT: Data Sources */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <IconBox
                            id="documents"
                            x={30 + X} y={60}
                            width={55} height={55}
                            icon={DocumentTextIcon}
                            label="Documents"
                            fillColor="fill-cyan-400/5"
                            strokeColor="stroke-cyan-400/60"
                            textColor="text-cyan-400"
                        />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
                        <IconBox
                            id="apis"
                            x={30 + X} y={140}
                            width={55} height={55}
                            icon={GlobeAltIcon}
                            label="APIs"
                            fillColor="fill-cyan-400/5"
                            strokeColor="stroke-cyan-400/60"
                            textColor="text-cyan-400"
                        />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <IconBox
                            id="files"
                            x={30 + X} y={220}
                            width={55} height={55}
                            icon={FolderIcon}
                            label="Files"
                            fillColor="fill-cyan-400/5"
                            strokeColor="stroke-cyan-400/60"
                            textColor="text-cyan-400"
                        />
                    </g>

                    {/* Sources → Ingest */}
                    <AnimatedPath d={`M ${85 + X} 87 L ${160 + X} 87 L ${160 + X} 75 L ${320 + X} 75`} />
                    <AnimatedPath d={`M ${85 + X} 167 L ${160 + X} 167 L ${160 + X} 95 L ${320 + X} 95`} />
                    <AnimatedPath d={`M ${85 + X} 247 L ${160 + X} 247 L ${160 + X} 115 L ${320 + X} 115`} />

                    {/* CENTER: Main Flow */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <LargeIconBox
                            id="ingest"
                            x={320 + X} y={55}
                            width={160} height={70}
                            icon={CloudArrowUpIcon}
                            label="Ingest"
                            fillColor="fill-blue-400/5"
                            strokeColor="stroke-blue-400/60"
                            textColor="text-blue-400"
                        />
                    </g>

                    <AnimatedPath d={`M ${400 + X} 125 L ${400 + X} 150`} />

                    {/* Embeddings */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <LargeIconBox
                            id="embeddings"
                            x={300 + X} y={150}
                            width={200} height={70}
                            icon={CubeIcon}
                            label="Embeddings"
                            fillColor="fill-emerald-400/5"
                            strokeColor="stroke-emerald-400/60"
                            textColor="text-emerald-400"
                        />
                    </g>

                    <AnimatedPath d={`M ${400 + X} 220 L ${400 + X} 250`} />

                    {/* Vector Store */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
                        <LargeIconBox
                            id="vectorstore"
                            x={310 + X} y={250}
                            width={180} height={70}
                            icon={CircleStackIcon}
                            label="Vector Store"
                            fillColor="fill-purple-400/5"
                            strokeColor="stroke-purple-400/60"
                            textColor="text-purple-400"
                        />
                    </g>

                    {/* Vector → Providers */}
                    <AnimatedPath d={`M ${350 + X} 320 L ${350 + X} 340 L ${270 + X} 340 L ${270 + X} 360`} />
                    <AnimatedPath d={`M ${400 + X} 320 L ${400 + X} 360`} />
                    <AnimatedPath d={`M ${450 + X} 320 L ${450 + X} 340 L ${530 + X} 340 L ${530 + X} 360`} />

                    {/* Storage Providers */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <LargeIconBox
                            id="pinecone"
                            x={230 + X} y={360}
                            width={80} height={60}
                            icon={ServerIcon}
                            label="Pinecone"
                            fillColor="fill-orange-400/5"
                            strokeColor="stroke-orange-400/60"
                            textColor="text-orange-400"
                        />
                        <LargeIconBox
                            id="weaviate"
                            x={360 + X} y={360}
                            width={80} height={60}
                            icon={ServerIcon}
                            label="Weaviate"
                            fillColor="fill-orange-400/5"
                            strokeColor="stroke-orange-400/60"
                            textColor="text-orange-400"
                        />
                        <LargeIconBox
                            id="qdrant"
                            x={490 + X} y={360}
                            width={80} height={60}
                            icon={ServerIcon}
                            label="Qdrant"
                            fillColor="fill-orange-400/5"
                            strokeColor="stroke-orange-400/60"
                            textColor="text-orange-400"
                        />
                    </g>

                    {/* Providers → Response */}
                    <AnimatedPath d={`M ${270 + X} 420 L ${270 + X} 440 L ${350 + X} 440 L ${350 + X} 455`} />
                    <AnimatedPath d={`M ${400 + X} 420 L ${400 + X} 455`} />
                    <AnimatedPath d={`M ${530 + X} 420 L ${530 + X} 440 L ${450 + X} 440 L ${450 + X} 455`} />

                    {/* Response */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
                        <LargeIconBox
                            id="response"
                            x={320 + X} y={455}
                            width={160} height={60}
                            icon={ArrowPathIcon}
                            label="Response"
                            fillColor="fill-sky-400/5"
                            strokeColor="stroke-sky-400/60"
                            textColor="text-sky-400"
                        />
                    </g>

                    {/* RIGHT: Observability */}
                    <AnimatedPath d={`M ${500 + X} 165 L ${580 + X} 165 L ${580 + X} 87 L ${650 + X} 87`} />
                    <AnimatedPath d={`M ${500 + X} 185 L ${650 + X} 185`} />
                    <AnimatedPath d={`M ${500 + X} 205 L ${580 + X} 205 L ${580 + X} 283 L ${650 + X} 283`} />

                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <IconBox
                            id="logs"
                            x={650 + X} y={60}
                            width={55} height={55}
                            icon={DocumentTextIcon}
                            label="Logs"
                            fillColor="fill-pink-400/5"
                            strokeColor="stroke-pink-400/60"
                            textColor="text-pink-400"
                        />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.45s" }}>
                        <IconBox
                            id="metrics"
                            x={650 + X} y={157}
                            width={55} height={55}
                            icon={ChartBarIcon}
                            label="Metrics"
                            fillColor="fill-pink-400/5"
                            strokeColor="stroke-pink-400/60"
                            textColor="text-pink-400"
                        />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <IconBox
                            id="index"
                            x={650 + X} y={255}
                            width={55} height={55}
                            icon={ShieldCheckIcon}
                            label="Index"
                            fillColor="fill-pink-400/5"
                            strokeColor="stroke-pink-400/60"
                            textColor="text-pink-400"
                        />
                    </g>

                    {/* Cache */}
                    <AnimatedPath d={`M ${490 + X} 285 L ${580 + X} 285 L ${580 + X} 370 L ${650 + X} 370`} />
                    <g className="animate-fade-in" style={{ animationDelay: "0.55s" }}>
                        <IconBox
                            id="cache"
                            x={650 + X} y={342}
                            width={55} height={55}
                            icon={ArchiveBoxIcon}
                            label="Cache"
                            fillColor="fill-amber-400/5"
                            strokeColor="stroke-amber-400/60"
                            textColor="text-amber-400"
                        />
                    </g>

                    {/* Cache → Response */}
                    <AnimatedPath d={`M ${677 + X} 397 L ${677 + X} 485 L ${480 + X} 485`} />
                </svg>
            </div>

            {/* ==================== MOBILE ==================== */}
            <div className="md:hidden flex flex-col items-center">
                <svg
                    viewBox="0 0 280 400"
                    className="w-full max-w-[280px] h-auto"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Simplified mobile version */}
                    <g className="animate-fade-in">
                        <rect x="100" y="10" width="80" height="55" rx="4" className="fill-blue-400/5 stroke-blue-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={100} y={10} width={80} height={55} color="text-blue-400" />
                        <foreignObject x="100" y="10" width="80" height="40">
                            <div className="w-full h-full flex items-center justify-center">
                                <CloudArrowUpIcon className="w-6 h-6 text-blue-400" />
                            </div>
                        </foreignObject>
                        <text x="140" y="58" textAnchor="middle" className="fill-blue-400 text-[10px]">Ingest</text>
                    </g>

                    <AnimatedPath d="M 140 65 L 140 85" />

                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="80" y="85" width="120" height="55" rx="4" className="fill-emerald-400/5 stroke-emerald-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={80} y={85} width={120} height={55} color="text-emerald-400" />
                        <foreignObject x="80" y="85" width="120" height="40">
                            <div className="w-full h-full flex items-center justify-center">
                                <CubeIcon className="w-6 h-6 text-emerald-400" />
                            </div>
                        </foreignObject>
                        <text x="140" y="133" textAnchor="middle" className="fill-emerald-400 text-[10px]">Embeddings</text>
                    </g>

                    <AnimatedPath d="M 140 140 L 140 160" />

                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect x="80" y="160" width="120" height="55" rx="4" className="fill-purple-400/5 stroke-purple-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDotsMobile x={80} y={160} width={120} height={55} color="text-purple-400" />
                        <foreignObject x="80" y="160" width="120" height="40">
                            <div className="w-full h-full flex items-center justify-center">
                                <CircleStackIcon className="w-6 h-6 text-purple-400" />
                            </div>
                        </foreignObject>
                        <text x="140" y="208" textAnchor="middle" className="fill-purple-400 text-[10px]">Vector Store</text>
                    </g>

                    <AnimatedPath d="M 100 215 L 100 235 L 50 235 L 50 250" />
                    <AnimatedPath d="M 140 215 L 140 250" />
                    <AnimatedPath d="M 180 215 L 180 235 L 230 235 L 230 250" />

                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="20" y="250" width="60" height="45" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={20} y={250} width={60} height={45} color="text-orange-400" />
                        <foreignObject x="20" y="250" width="60" height="32">
                            <div className="w-full h-full flex items-center justify-center">
                                <ServerIcon className="w-5 h-5 text-orange-400" />
                            </div>
                        </foreignObject>
                        <text x="50" y="288" textAnchor="middle" className="fill-orange-400 text-[8px]">Pinecone</text>

                        <rect x="110" y="250" width="60" height="45" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={110} y={250} width={60} height={45} color="text-orange-400" />
                        <foreignObject x="110" y="250" width="60" height="32">
                            <div className="w-full h-full flex items-center justify-center">
                                <ServerIcon className="w-5 h-5 text-orange-400" />
                            </div>
                        </foreignObject>
                        <text x="140" y="288" textAnchor="middle" className="fill-orange-400 text-[8px]">Weaviate</text>

                        <rect x="200" y="250" width="60" height="45" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={200} y={250} width={60} height={45} color="text-orange-400" />
                        <foreignObject x="200" y="250" width="60" height="32">
                            <div className="w-full h-full flex items-center justify-center">
                                <ServerIcon className="w-5 h-5 text-orange-400" />
                            </div>
                        </foreignObject>
                        <text x="230" y="288" textAnchor="middle" className="fill-orange-400 text-[8px]">Qdrant</text>
                    </g>

                    <AnimatedPath d="M 50 295 L 50 315 L 100 315 L 100 330" />
                    <AnimatedPath d="M 140 295 L 140 330" />
                    <AnimatedPath d="M 230 295 L 230 315 L 180 315 L 180 330" />

                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="80" y="330" width="120" height="50" rx="4" className="fill-sky-400/5 stroke-sky-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={80} y={330} width={120} height={50} color="text-sky-400" />
                        <foreignObject x="80" y="330" width="120" height="35">
                            <div className="w-full h-full flex items-center justify-center">
                                <ArrowPathIcon className="w-6 h-6 text-sky-400" />
                            </div>
                        </foreignObject>
                        <text x="140" y="373" textAnchor="middle" className="fill-sky-400 text-[10px]">Response</text>
                    </g>
                </svg>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/30 -mx-8 px-8">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Semantic search
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Vector embeddings
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> RAG-ready
                </span>
            </div>
        </div>
    );
};
