"use client";

import React, { useState, useCallback, useRef } from "react";

/**
 * Compute Diagram - Styled like AI Gateway with draggable nodes
 * Build & Deploy as one container with nested items
 */

interface NodePosition {
    x: number;
    y: number;
}

interface DragState {
    isDragging: boolean;
    nodeId: string | null;
    offsetX: number;
    offsetY: number;
}

export const ComputeDiagram = () => {
    const X = 50;

    // ALL node positions
    const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({
        // Left side: Deploy sources
        github: { x: 30 + X, y: 60 },
        cli: { x: 30 + X, y: 140 },
        dashboard: { x: 30 + X, y: 220 },
        // Center: Build & Deploy (one large container)
        build: { x: 290 + X, y: 35 },
        // Right side: Infrastructure
        edge: { x: 650 + X, y: 60 },
        cpu: { x: 650 + X, y: 140 },
        gpu: { x: 650 + X, y: 220 },
        dedicated: { x: 650 + X, y: 300 },
        // Bottom: Output
        output: { x: 320 + X, y: 400 },
    });

    // Node sizes
    const sizes: Record<string, { w: number; h: number }> = {
        github: { w: 120, h: 50 },
        cli: { w: 120, h: 50 },
        dashboard: { w: 120, h: 50 },
        build: { w: 220, h: 200 }, // Large container
        edge: { w: 120, h: 50 },
        cpu: { w: 120, h: 50 },
        gpu: { w: 120, h: 50 },
        dedicated: { w: 120, h: 50 },
        output: { w: 200, h: 70 },
    };

    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        nodeId: null,
        offsetX: 0,
        offsetY: 0,
    });

    const svgRef = useRef<SVGSVGElement>(null);

    const getSVGCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svg = svgRef.current;
        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const svgPoint = point.matrixTransform(ctm.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
    }, []);

    const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
        e.preventDefault();
        const coords = getSVGCoords(e);
        const nodePos = nodePositions[nodeId];
        setDragState({
            isDragging: true,
            nodeId,
            offsetX: coords.x - nodePos.x,
            offsetY: coords.y - nodePos.y,
        });
    }, [getSVGCoords, nodePositions]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragState.isDragging || !dragState.nodeId) return;
        const coords = getSVGCoords(e);
        setNodePositions(prev => ({
            ...prev,
            [dragState.nodeId!]: {
                x: coords.x - dragState.offsetX,
                y: coords.y - dragState.offsetY
            },
        }));
    }, [dragState, getSVGCoords]);

    const handleMouseUp = useCallback(() => {
        setDragState(prev => ({ ...prev, isDragging: false, nodeId: null }));
    }, []);

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

    // Animated path
    const AnimatedPath = ({ d }: { d: string }) => (
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className="text-muted-foreground/40" fill="none">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
        </path>
    );

    // Flat draggable box
    const DraggableBox = ({
        nodeId,
        fillColor, strokeColor, label, sublabel,
        children
    }: {
        nodeId: string;
        fillColor: string; strokeColor: string; label: string; sublabel?: string;
        children?: React.ReactNode;
    }) => {
        const pos = nodePositions[nodeId];
        const size = sizes[nodeId];
        const isDragging = dragState.nodeId === nodeId;

        return (
            <g
                onMouseDown={(e) => handleMouseDown(nodeId, e)}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <rect
                    x={pos.x} y={pos.y}
                    width={size.w} height={size.h}
                    rx="4"
                    className={`${fillColor} ${strokeColor}`}
                    strokeWidth={isDragging ? "2" : "1.5"}
                    strokeDasharray="8 4"
                />
                <CornerDots x={pos.x} y={pos.y} width={size.w} height={size.h} color={strokeColor} />

                <text
                    x={pos.x + size.w / 2}
                    y={pos.y + (children ? 28 : size.h / 2 + (sublabel ? -5 : 5))}
                    textAnchor="middle"
                    className={`${strokeColor} text-[14px] font-medium pointer-events-none`}
                    fill="currentColor"
                >
                    {label}
                </text>
                {sublabel && !children && (
                    <text
                        x={pos.x + size.w / 2}
                        y={pos.y + size.h / 2 + 13}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[11px] pointer-events-none"
                    >
                        {sublabel}
                    </text>
                )}

                {children}
            </g>
        );
    };

    // Helper to get edge points
    const getRight = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        const size = sizes[nodeId];
        return { x: pos.x + size.w, y: pos.y + size.h / 2 };
    };

    const getLeft = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        return { x: pos.x, y: pos.y + sizes[nodeId].h / 2 };
    };

    const getTop = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        return { x: pos.x + sizes[nodeId].w / 2, y: pos.y };
    };

    const getBottom = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        return { x: pos.x + sizes[nodeId].w / 2, y: pos.y + sizes[nodeId].h };
    };

    // Dynamic positions
    const bld = nodePositions.build;
    const bldSize = sizes.build;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">Compute</h3>
                <p className="text-muted-foreground text-sm md:text-base">
                    Serverless AI infrastructure. Deploy functions, agents, and run inference at the edge.
                </p>
            </div>

            {/* ==================== DESKTOP: Draggable ==================== */}
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[520px]">
                <svg
                    ref={svgRef}
                    viewBox="0 0 900 530"
                    className="w-full h-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* LEFT: Deploy Sources → Build */}
                    <AnimatedPath d={`M ${getRight("github").x} ${getRight("github").y} L ${getRight("github").x + 50} ${getRight("github").y} L ${getRight("github").x + 50} ${bld.y + 40} L ${bld.x} ${bld.y + 40}`} />
                    <AnimatedPath d={`M ${getRight("cli").x} ${getRight("cli").y} L ${getRight("cli").x + 70} ${getRight("cli").y} L ${getRight("cli").x + 70} ${bld.y + bldSize.h / 2} L ${bld.x} ${bld.y + bldSize.h / 2}`} />
                    <AnimatedPath d={`M ${getRight("dashboard").x} ${getRight("dashboard").y} L ${getRight("dashboard").x + 50} ${getRight("dashboard").y} L ${getRight("dashboard").x + 50} ${bld.y + bldSize.h - 40} L ${bld.x} ${bld.y + bldSize.h - 40}`} />

                    {/* Build → Runtime infra (right side) */}
                    <AnimatedPath d={`M ${bld.x + bldSize.w} ${bld.y + 50} L ${bld.x + bldSize.w + 80} ${bld.y + 50} L ${bld.x + bldSize.w + 80} ${getLeft("edge").y} L ${getLeft("edge").x} ${getLeft("edge").y}`} />
                    <AnimatedPath d={`M ${bld.x + bldSize.w} ${bld.y + 90} L ${bld.x + bldSize.w + 100} ${bld.y + 90} L ${bld.x + bldSize.w + 100} ${getLeft("cpu").y} L ${getLeft("cpu").x} ${getLeft("cpu").y}`} />
                    <AnimatedPath d={`M ${bld.x + bldSize.w} ${bld.y + 130} L ${bld.x + bldSize.w + 80} ${bld.y + 130} L ${bld.x + bldSize.w + 80} ${getLeft("gpu").y} L ${getLeft("gpu").x} ${getLeft("gpu").y}`} />
                    <AnimatedPath d={`M ${bld.x + bldSize.w} ${bld.y + 170} L ${bld.x + bldSize.w + 60} ${bld.y + 170} L ${bld.x + bldSize.w + 60} ${getLeft("dedicated").y} L ${getLeft("dedicated").x} ${getLeft("dedicated").y}`} />

                    {/* Runtime infra → Output */}
                    <AnimatedPath d={`M ${getRight("edge").x} ${getRight("edge").y} L ${getRight("edge").x + 40} ${getRight("edge").y} L ${getRight("edge").x + 40} ${getTop("output").y - 30} L ${getTop("output").x + 30} ${getTop("output").y - 30} L ${getTop("output").x + 30} ${getTop("output").y}`} />
                    <AnimatedPath d={`M ${getRight("cpu").x} ${getRight("cpu").y} L ${getRight("cpu").x + 60} ${getRight("cpu").y} L ${getRight("cpu").x + 60} ${getTop("output").y - 20} L ${getTop("output").x + 50} ${getTop("output").y - 20} L ${getTop("output").x + 50} ${getTop("output").y}`} />
                    <AnimatedPath d={`M ${getRight("gpu").x} ${getRight("gpu").y} L ${getRight("gpu").x + 80} ${getRight("gpu").y} L ${getRight("gpu").x + 80} ${getTop("output").y - 10} L ${getTop("output").x + 70} ${getTop("output").y - 10} L ${getTop("output").x + 70} ${getTop("output").y}`} />
                    <AnimatedPath d={`M ${getRight("dedicated").x} ${getRight("dedicated").y} L ${getRight("dedicated").x + 100} ${getRight("dedicated").y} L ${getRight("dedicated").x + 100} ${getTop("output").y - 5} L ${getTop("output").x + 90} ${getTop("output").y - 5} L ${getTop("output").x + 90} ${getTop("output").y}`} />

                    {/* Build → Output (direct) */}
                    <AnimatedPath d={`M ${bld.x + bldSize.w / 2} ${bld.y + bldSize.h} L ${bld.x + bldSize.w / 2} ${getTop("output").y}`} />

                    {/* LEFT: Deploy Sources */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <DraggableBox nodeId="github" fillColor="fill-cyan-400/5" strokeColor="stroke-cyan-400/60 text-cyan-400" label="GitHub" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
                        <DraggableBox nodeId="cli" fillColor="fill-cyan-400/5" strokeColor="stroke-cyan-400/60 text-cyan-400" label="CLI" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <DraggableBox nodeId="dashboard" fillColor="fill-cyan-400/5" strokeColor="stroke-cyan-400/60 text-cyan-400" label="Dashboard" />
                    </g>

                    {/* CENTER: Build & Deploy (large container with nested items) */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <DraggableBox nodeId="build" fillColor="fill-emerald-400/5" strokeColor="stroke-emerald-400/60 text-emerald-400" label="Build & Deploy">
                            {/* Nested items inside */}
                            <rect x={bld.x + 20} y={bld.y + 50} width={bldSize.w - 40} height="35" rx="3" className="fill-background stroke-emerald-400/40 pointer-events-none" strokeWidth="1" strokeDasharray="4 2" />
                            <text x={bld.x + bldSize.w / 2} y={bld.y + 72} textAnchor="middle" className="fill-muted-foreground text-[11px] pointer-events-none">Serverless Functions</text>

                            <rect x={bld.x + 20} y={bld.y + 95} width={bldSize.w - 40} height="35" rx="3" className="fill-background stroke-emerald-400/40 pointer-events-none" strokeWidth="1" strokeDasharray="4 2" />
                            <text x={bld.x + bldSize.w / 2} y={bld.y + 117} textAnchor="middle" className="fill-muted-foreground text-[11px] pointer-events-none">AI Agents</text>

                            <rect x={bld.x + 20} y={bld.y + 140} width={bldSize.w - 40} height="35" rx="3" className="fill-background stroke-emerald-400/40 pointer-events-none" strokeWidth="1" strokeDasharray="4 2" />
                            <text x={bld.x + bldSize.w / 2} y={bld.y + 162} textAnchor="middle" className="fill-muted-foreground text-[11px] pointer-events-none">Custom Models</text>
                        </DraggableBox>
                    </g>

                    {/* RIGHT: Infrastructure */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <DraggableBox nodeId="edge" fillColor="fill-rose-400/5" strokeColor="stroke-rose-400/60 text-rose-400" label="Edge Nodes" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
                        <DraggableBox nodeId="cpu" fillColor="fill-rose-400/5" strokeColor="stroke-rose-400/60 text-rose-400" label="CPU Workers" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <DraggableBox nodeId="gpu" fillColor="fill-rose-400/5" strokeColor="stroke-rose-400/60 text-rose-400" label="GPU Cluster" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.45s" }}>
                        <DraggableBox nodeId="dedicated" fillColor="fill-rose-400/5" strokeColor="stroke-rose-400/60 text-rose-400" label="Dedicated" />
                    </g>

                    {/* Output */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <DraggableBox nodeId="output" fillColor="fill-sky-400/5" strokeColor="stroke-sky-400/60 text-sky-400" label="Output" sublabel="Auto-scale • Zero cold starts" />
                    </g>
                </svg>
            </div>

            {/* ==================== MOBILE (Static) ==================== */}
            <div className="md:hidden flex flex-col items-center">
                <svg
                    viewBox="0 0 280 420"
                    className="w-full max-w-[280px] h-auto"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Deploy */}
                    <g className="animate-fade-in">
                        <rect x="65" y="10" width="150" height="50" rx="4" className="fill-cyan-400/5 stroke-cyan-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={65} y={10} width={150} height={50} color="text-cyan-400" />
                        <text x="140" y="40" textAnchor="middle" className="fill-cyan-400 text-[14px] font-medium">Deploy</text>
                    </g>

                    <AnimatedPath d="M 140 60 L 140 85" />

                    {/* Build & Deploy */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <rect x="40" y="85" width="200" height="100" rx="4" className="fill-emerald-400/5 stroke-emerald-400/60" strokeWidth="1.5" strokeDasharray="8 4" />
                        <CornerDotsMobile x={40} y={85} width={200} height={100} color="text-emerald-400" />
                        <text x="140" y="108" textAnchor="middle" className="fill-emerald-400 text-[14px] font-medium">Build & Deploy</text>

                        <rect x="55" y="118" width="170" height="25" rx="3" className="fill-background stroke-emerald-400/30" strokeWidth="1" strokeDasharray="3 2" />
                        <text x="140" y="135" textAnchor="middle" className="fill-muted-foreground text-[10px]">Functions • Agents • Models</text>

                        <rect x="55" y="150" width="170" height="25" rx="3" className="fill-background stroke-emerald-400/30" strokeWidth="1" strokeDasharray="3 2" />
                        <text x="140" y="167" textAnchor="middle" className="fill-muted-foreground text-[10px]">Auto-scale • Zero cold starts</text>
                    </g>

                    <AnimatedPath d="M 140 185 L 140 210" />

                    {/* Runtime Grid */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="10" y="210" width="125" height="45" rx="4" className="fill-rose-400/5 stroke-rose-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={10} y={210} width={125} height={45} color="text-rose-400" />
                        <text x="72" y="237" textAnchor="middle" className="fill-rose-400 text-[11px]">Edge Nodes</text>

                        <rect x="145" y="210" width="125" height="45" rx="4" className="fill-rose-400/5 stroke-rose-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={145} y={210} width={125} height={45} color="text-rose-400" />
                        <text x="207" y="237" textAnchor="middle" className="fill-rose-400 text-[11px]">GPU Cluster</text>
                    </g>

                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="10" y="265" width="125" height="45" rx="4" className="fill-rose-400/5 stroke-rose-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={10} y={265} width={125} height={45} color="text-rose-400" />
                        <text x="72" y="292" textAnchor="middle" className="fill-rose-400 text-[11px]">CPU Workers</text>

                        <rect x="145" y="265" width="125" height="45" rx="4" className="fill-rose-400/5 stroke-rose-400/60" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={145} y={265} width={125} height={45} color="text-rose-400" />
                        <text x="207" y="292" textAnchor="middle" className="fill-rose-400 text-[11px]">Dedicated</text>
                    </g>

                    <AnimatedPath d="M 72 255 L 72 265" />
                    <AnimatedPath d="M 207 255 L 207 265" />
                    <AnimatedPath d="M 72 310 L 72 330 L 100 330 L 100 355" />
                    <AnimatedPath d="M 207 310 L 207 330 L 180 330 L 180 355" />

                    {/* Output */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <rect x="50" y="355" width="180" height="55" rx="4" className="fill-sky-400/5 stroke-sky-400/60" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={50} y={355} width={180} height={55} color="text-sky-400" />
                        <text x="140" y="382" textAnchor="middle" className="fill-sky-400 text-[14px] font-medium">Output</text>
                        <text x="140" y="400" textAnchor="middle" className="fill-muted-foreground text-[10px]">Auto-scale • Zero cold starts</text>
                    </g>
                </svg>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/30 -mx-8 px-8">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Zero cold starts
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Auto-scaling
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Pay-per-use
                </span>
            </div>
        </div>
    );
};
