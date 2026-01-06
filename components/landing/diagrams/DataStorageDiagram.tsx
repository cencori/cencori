"use client";

import React from "react";

/**
 * Data Storage Diagram - Unique horizontal/hub layout
 * Different from the vertical flow of other diagrams
 */
export const DataStorageDiagram = () => {
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
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[400px]">
                <svg
                    viewBox="0 0 900 420"
                    className="w-full h-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* ========== TOP ROW: Input Sources ========== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <rect x="120" y="30" width="100" height="45" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={120} y={30} width={100} height={45} color="text-cyan-400" />
                        <text x="170" y="58" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Documents</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
                        <rect x="260" y="30" width="100" height="45" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={260} y={30} width={100} height={45} color="text-cyan-400" />
                        <text x="310" y="58" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">APIs</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="400" y="30" width="100" height="45" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={400} y={30} width={100} height={45} color="text-cyan-400" />
                        <text x="450" y="58" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Files</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <rect x="540" y="30" width="100" height="45" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={540} y={30} width={100} height={45} color="text-cyan-400" />
                        <text x="590" y="58" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Webhooks</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect x="680" y="30" width="100" height="45" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={680} y={30} width={100} height={45} color="text-cyan-400" />
                        <text x="730" y="58" textAnchor="middle" className="fill-cyan-400 text-[13px] font-medium">Streams</text>
                    </g>

                    {/* Sources → Ingest */}
                    <AnimatedPath d="M 170 75 L 170 95 L 310 95 L 310 110" />
                    <AnimatedPath d="M 310 75 L 310 110" />
                    <AnimatedPath d="M 450 75 L 450 95 L 380 95 L 380 110" />
                    <AnimatedPath d="M 590 75 L 590 95 L 520 95 L 520 110" />
                    <AnimatedPath d="M 730 75 L 730 95 L 590 95 L 590 110" />

                    {/* ========== INGEST ROW ========== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
                        <rect x="200" y="110" width="500" height="55" rx="4" className="fill-blue-400/5 stroke-blue-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDots x={200} y={110} width={500} height={55} color="text-blue-400" />
                        <text x="450" y="143" textAnchor="middle" className="fill-blue-400 text-[16px] font-medium">Ingest & Transform</text>
                    </g>

                    <AnimatedPath d="M 450 165 L 450 195" />

                    {/* ========== CENTRAL HUB: Vector Database ========== */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="280" y="195" width="340" height="90" rx="6" className="fill-purple-400/10 stroke-purple-400/60" strokeWidth="2" strokeDasharray="10 5" />
                        <CornerDots x={280} y={195} width={340} height={90} color="text-purple-400" />
                        <text x="450" y="235" textAnchor="middle" className="fill-purple-400 text-[18px] font-semibold">Vector Database</text>
                        <text x="450" y="260" textAnchor="middle" className="fill-muted-foreground text-[12px]">Embeddings • Similarity Search • Semantic Query</text>
                    </g>

                    {/* ========== BOTTOM: Providers (horizontal) ========== */}
                    <AnimatedPath d="M 340 285 L 340 310" />
                    <AnimatedPath d="M 450 285 L 450 310" />
                    <AnimatedPath d="M 560 285 L 560 310" />

                    <g className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
                        <rect x="80" y="310" width="140" height="50" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={80} y={310} width={140} height={50} color="text-orange-400" />
                        <text x="150" y="340" textAnchor="middle" className="fill-orange-400 text-[13px] font-medium">Pinecone</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="260" y="310" width="140" height="50" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={260} y={310} width={140} height={50} color="text-orange-400" />
                        <text x="330" y="340" textAnchor="middle" className="fill-orange-400 text-[13px] font-medium">Weaviate</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.45s" }}>
                        <rect x="440" y="310" width="140" height="50" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={440} y={310} width={140} height={50} color="text-orange-400" />
                        <text x="510" y="340" textAnchor="middle" className="fill-orange-400 text-[13px] font-medium">Qdrant</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <rect x="620" y="310" width="140" height="50" rx="4" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={620} y={310} width={140} height={50} color="text-orange-400" />
                        <text x="690" y="340" textAnchor="middle" className="fill-orange-400 text-[13px] font-medium">Chroma</text>
                    </g>

                    {/* Connect to Vector DB */}
                    <AnimatedPath d="M 280 240 L 220 240 L 220 335 L 150 335 L 150 310" />
                    <AnimatedPath d="M 330 285 L 330 310" />
                    <AnimatedPath d="M 510 285 L 510 310" />
                    <AnimatedPath d="M 620 240 L 700 240 L 700 310" />

                    {/* ========== SIDE: Cache & Observability ========== */}
                    <AnimatedPath d="M 620 240 L 780 240" />
                    <g className="animate-fade-in" style={{ animationDelay: "0.55s" }}>
                        <rect x="780" y="140" width="100" height="45" rx="4" className="fill-amber-400/5 stroke-amber-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={780} y={140} width={100} height={45} color="text-amber-400" />
                        <text x="830" y="168" textAnchor="middle" className="fill-amber-400 text-[13px] font-medium">Cache</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.6s" }}>
                        <rect x="780" y="215" width="100" height="45" rx="4" className="fill-pink-400/5 stroke-pink-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={780} y={215} width={100} height={45} color="text-pink-400" />
                        <text x="830" y="243" textAnchor="middle" className="fill-pink-400 text-[13px] font-medium">Metrics</text>
                    </g>
                    <AnimatedPath d="M 780 162 L 720 162 L 720 215 L 620 215" />
                    <AnimatedPath d="M 780 237 L 720 237 L 720 265 L 620 265" />

                    {/* ========== LEFT: Query Interface ========== */}
                    <AnimatedPath d="M 280 240 L 120 240" />
                    <g className="animate-fade-in" style={{ animationDelay: "0.65s" }}>
                        <rect x="20" y="195" width="100" height="45" rx="4" className="fill-emerald-400/5 stroke-emerald-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={20} y={195} width={100} height={45} color="text-emerald-400" />
                        <text x="70" y="223" textAnchor="middle" className="fill-emerald-400 text-[13px] font-medium">Query</text>
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.7s" }}>
                        <rect x="20" y="260" width="100" height="45" rx="4" className="fill-sky-400/5 stroke-sky-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDots x={20} y={260} width={100} height={45} color="text-sky-400" />
                        <text x="70" y="288" textAnchor="middle" className="fill-sky-400 text-[13px] font-medium">Response</text>
                    </g>
                    <AnimatedPath d="M 120 217 L 150 217 L 150 240 L 280 240" />
                    <AnimatedPath d="M 70 260 L 70 240 L 120 240" />
                </svg>
            </div>

            {/* ==================== MOBILE ==================== */}
            <div className="md:hidden flex flex-col items-center">
                <svg
                    viewBox="0 0 280 360"
                    className="w-full max-w-[280px] h-auto"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Sources row */}
                    <g className="animate-fade-in">
                        <rect x="20" y="15" width="75" height="35" rx="3" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={20} y={15} width={75} height={35} color="text-cyan-400" />
                        <text x="57" y="37" textAnchor="middle" className="fill-cyan-400 text-[9px]">Documents</text>

                        <rect x="103" y="15" width="75" height="35" rx="3" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={103} y={15} width={75} height={35} color="text-cyan-400" />
                        <text x="140" y="37" textAnchor="middle" className="fill-cyan-400 text-[9px]">APIs</text>

                        <rect x="186" y="15" width="75" height="35" rx="3" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={186} y={15} width={75} height={35} color="text-cyan-400" />
                        <text x="223" y="37" textAnchor="middle" className="fill-cyan-400 text-[9px]">Files</text>
                    </g>

                    <AnimatedPath d="M 57 50 L 57 65 L 140 65 L 140 80" />
                    <AnimatedPath d="M 140 50 L 140 80" />
                    <AnimatedPath d="M 223 50 L 223 65 L 140 65 L 140 80" />

                    {/* Ingest */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <rect x="40" y="80" width="200" height="40" rx="4" className="fill-blue-400/5 stroke-blue-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={40} y={80} width={200} height={40} color="text-blue-400" />
                        <text x="140" y="105" textAnchor="middle" className="fill-blue-400 text-[12px] font-medium">Ingest & Transform</text>
                    </g>

                    <AnimatedPath d="M 140 120 L 140 140" />

                    {/* Vector Database - Central */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                        <rect x="30" y="140" width="220" height="70" rx="4" className="fill-purple-400/10 stroke-purple-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDotsMobile x={30} y={140} width={220} height={70} color="text-purple-400" />
                        <text x="140" y="172" textAnchor="middle" className="fill-purple-400 text-[14px] font-semibold">Vector Database</text>
                        <text x="140" y="192" textAnchor="middle" className="fill-muted-foreground text-[9px]">Embeddings • Search • Query</text>
                    </g>

                    <AnimatedPath d="M 70 210 L 70 230 L 50 230 L 50 245" />
                    <AnimatedPath d="M 140 210 L 140 245" />
                    <AnimatedPath d="M 210 210 L 210 230 L 230 230 L 230 245" />

                    {/* Providers */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="10" y="245" width="80" height="35" rx="3" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={10} y={245} width={80} height={35} color="text-orange-400" />
                        <text x="50" y="267" textAnchor="middle" className="fill-orange-400 text-[9px]">Pinecone</text>

                        <rect x="100" y="245" width="80" height="35" rx="3" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={100} y={245} width={80} height={35} color="text-orange-400" />
                        <text x="140" y="267" textAnchor="middle" className="fill-orange-400 text-[9px]">Weaviate</text>

                        <rect x="190" y="245" width="80" height="35" rx="3" className="fill-orange-400/5 stroke-orange-400/60" strokeWidth="1" strokeDasharray="4 2" />
                        <CornerDotsMobile x={190} y={245} width={80} height={35} color="text-orange-400" />
                        <text x="230" y="267" textAnchor="middle" className="fill-orange-400 text-[9px]">Qdrant</text>
                    </g>

                    <AnimatedPath d="M 50 280 L 50 300 L 100 300 L 100 310" />
                    <AnimatedPath d="M 140 280 L 140 310" />
                    <AnimatedPath d="M 230 280 L 230 300 L 180 300 L 180 310" />

                    {/* Response */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="60" y="310" width="160" height="40" rx="4" className="fill-sky-400/5 stroke-sky-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={60} y={310} width={160} height={40} color="text-sky-400" />
                        <text x="140" y="335" textAnchor="middle" className="fill-sky-400 text-[12px] font-medium">Response</text>
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
