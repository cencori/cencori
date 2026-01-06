"use client";

import React, { useState, useCallback, useRef } from "react";

/**
 * Compute Diagram - ALL NODES DRAGGABLE
 * Every box can be dragged and paths follow dynamically
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
        // Deploy sources
        github: { x: 30 + X, y: 110 },
        cli: { x: 30 + X, y: 195 },
        dashboard: { x: 30 + X, y: 280 },
        // Build
        build: { x: 300 + X, y: 80 },
        // Runtime
        edge: { x: 620 + X, y: 65 },
        cpu: { x: 620 + X, y: 150 },
        gpu: { x: 620 + X, y: 235 },
        dedicated: { x: 620 + X, y: 320 },
        // Output
        output: { x: 300 + X, y: 400 },
    });

    // Node sizes
    const sizes: Record<string, { w: number; h: number }> = {
        github: { w: 130, h: 55 },
        cli: { w: 130, h: 55 },
        dashboard: { w: 130, h: 55 },
        build: { w: 200, h: 200 },
        edge: { w: 150, h: 55 },
        cpu: { w: 150, h: 55 },
        gpu: { w: 150, h: 55 },
        dedicated: { w: 150, h: 55 },
        output: { w: 200, h: 100 },
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

    const AnimatedPath = ({ d }: { d: string }) => (
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" className="text-muted-foreground/40" fill="none">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
        </path>
    );

    // Generic draggable box
    const DraggableBox = ({
        nodeId,
        fillColor, strokeColor, label, sublabel,
        layers = 2, offset = 5,
        children
    }: {
        nodeId: string;
        fillColor: string; strokeColor: string; label: string; sublabel?: string;
        layers?: number; offset?: number;
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
                {/* Shadow layers */}
                {Array.from({ length: layers }).map((_, i) => {
                    const layerOffset = (layers - i) * offset;
                    return (
                        <rect
                            key={i}
                            x={pos.x + layerOffset}
                            y={pos.y + layerOffset}
                            width={size.w}
                            height={size.h}
                            rx="4"
                            className={fillColor}
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeDasharray="6 3"
                            style={{ opacity: 0.15 + i * 0.1 }}
                        />
                    );
                })}

                {/* Main box */}
                <rect x={pos.x} y={pos.y} width={size.w} height={size.h} rx="4" className={fillColor} />
                <rect
                    x={pos.x} y={pos.y} width={size.w} height={size.h} rx="4"
                    className={strokeColor} fill="none"
                    strokeWidth={isDragging ? "2" : "1.5"}
                    strokeDasharray="6 3"
                />

                <CornerDots x={pos.x} y={pos.y} width={size.w} height={size.h} color={strokeColor} />

                {label && (
                    <text
                        x={pos.x + size.w / 2}
                        y={pos.y + (children ? 30 : size.h / 2 + (sublabel ? -3 : 5))}
                        textAnchor="middle"
                        className={`${strokeColor} text-[14px] font-medium pointer-events-none`}
                        fill="currentColor"
                    >
                        {label}
                    </text>
                )}
                {sublabel && (
                    <text x={pos.x + size.w / 2} y={pos.y + size.h / 2 + 15} textAnchor="middle" className="fill-muted-foreground text-[10px] pointer-events-none">
                        {sublabel}
                    </text>
                )}

                {/* Nested content */}
                {children}
            </g>
        );
    };

    // Helper to get center points
    const getCenter = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        const size = sizes[nodeId];
        return { x: pos.x + size.w / 2, y: pos.y + size.h / 2 };
    };

    const getRight = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        const size = sizes[nodeId];
        return { x: pos.x + size.w, y: pos.y + size.h / 2 };
    };

    const getLeft = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        const size = sizes[nodeId];
        return { x: pos.x, y: pos.y + size.h / 2 };
    };

    const getTop = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        const size = sizes[nodeId];
        return { x: pos.x + size.w / 2, y: pos.y };
    };

    const getBottom = (nodeId: string) => {
        const pos = nodePositions[nodeId];
        const size = sizes[nodeId];
        return { x: pos.x + size.w / 2, y: pos.y + size.h };
    };

    // Dynamic orthogonal path from point A to point B
    const orthoPath = (from: { x: number, y: number }, to: { x: number, y: number }, midXRatio = 0.5) => {
        const midX = from.x + (to.x - from.x) * midXRatio;
        return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
    };

    // Deploy → Build paths
    const pathGithubToBuild = orthoPath(getRight("github"), getLeft("build"), 0.4);
    const pathCliToBuild = orthoPath(getRight("cli"), { x: nodePositions.build.x, y: nodePositions.build.y + 100 }, 0.4);
    const pathDashboardToBuild = orthoPath(getRight("dashboard"), { x: nodePositions.build.x, y: nodePositions.build.y + 160 }, 0.4);

    // Build → Runtime paths
    const buildRight = { x: nodePositions.build.x + sizes.build.w, y: nodePositions.build.y + 60 };
    const buildRight2 = { x: nodePositions.build.x + sizes.build.w, y: nodePositions.build.y + 100 };
    const buildRight3 = { x: nodePositions.build.x + sizes.build.w, y: nodePositions.build.y + 140 };
    const buildRight4 = { x: nodePositions.build.x + sizes.build.w, y: nodePositions.build.y + 180 };

    const pathBuildToEdge = orthoPath(buildRight, getLeft("edge"), 0.3);
    const pathBuildToCpu = orthoPath(buildRight2, getLeft("cpu"), 0.3);
    const pathBuildToGpu = orthoPath(buildRight3, getLeft("gpu"), 0.3);
    const pathBuildToDedicated = orthoPath(buildRight4, getLeft("dedicated"), 0.3);

    // Runtime → Output paths
    const outputTop = getTop("output");
    const pathEdgeToOutput = `M ${getRight("edge").x} ${getRight("edge").y} L ${getRight("edge").x + 40} ${getRight("edge").y} L ${getRight("edge").x + 40} ${outputTop.y - 20} L ${outputTop.x - 30} ${outputTop.y - 20} L ${outputTop.x - 30} ${outputTop.y}`;
    const pathCpuToOutput = `M ${getRight("cpu").x} ${getRight("cpu").y} L ${getRight("cpu").x + 60} ${getRight("cpu").y} L ${getRight("cpu").x + 60} ${outputTop.y - 10} L ${outputTop.x - 10} ${outputTop.y - 10} L ${outputTop.x - 10} ${outputTop.y}`;
    const pathGpuToOutput = `M ${getRight("gpu").x} ${getRight("gpu").y} L ${getRight("gpu").x + 80} ${getRight("gpu").y} L ${getRight("gpu").x + 80} ${outputTop.y - 10} L ${outputTop.x + 10} ${outputTop.y - 10} L ${outputTop.x + 10} ${outputTop.y}`;
    const pathDedicatedToOutput = `M ${getRight("dedicated").x} ${getRight("dedicated").y} L ${getRight("dedicated").x + 100} ${getRight("dedicated").y} L ${getRight("dedicated").x + 100} ${outputTop.y - 20} L ${outputTop.x + 30} ${outputTop.y - 20} L ${outputTop.x + 30} ${outputTop.y}`;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground mb-2">Compute</h3>
                <p className="text-muted-foreground text-sm md:text-base">
                    Serverless AI infrastructure. Deploy functions, agents, and run inference at the edge.
                    <span className="ml-2 text-rose-400 text-xs">(Drag any box!)</span>
                </p>
            </div>

            {/* ==================== DESKTOP: ALL DRAGGABLE ==================== */}
            <div className="hidden md:flex relative flex-1 justify-center items-center min-h-[520px]">
                <svg
                    ref={svgRef}
                    viewBox="0 0 950 550"
                    className="w-full h-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Deploy → Build paths */}
                    <AnimatedPath d={pathGithubToBuild} />
                    <AnimatedPath d={pathCliToBuild} />
                    <AnimatedPath d={pathDashboardToBuild} />

                    {/* Build → Runtime paths */}
                    <AnimatedPath d={pathBuildToEdge} />
                    <AnimatedPath d={pathBuildToCpu} />
                    <AnimatedPath d={pathBuildToGpu} />
                    <AnimatedPath d={pathBuildToDedicated} />

                    {/* Runtime → Output paths */}
                    <AnimatedPath d={pathEdgeToOutput} />
                    <AnimatedPath d={pathCpuToOutput} />
                    <AnimatedPath d={pathGpuToOutput} />
                    <AnimatedPath d={pathDedicatedToOutput} />

                    {/* Deploy Sources */}
                    <g className="animate-fade-in" style={{ animationDelay: "0s" }}>
                        <DraggableBox nodeId="github" fillColor="fill-violet-400/10" strokeColor="text-violet-400" label="GitHub" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
                        <DraggableBox nodeId="cli" fillColor="fill-violet-400/10" strokeColor="text-violet-400" label="CLI" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                        <DraggableBox nodeId="dashboard" fillColor="fill-violet-400/10" strokeColor="text-violet-400" label="Dashboard" />
                    </g>

                    {/* Build & Deploy */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <DraggableBox nodeId="build" fillColor="fill-teal-400/10" strokeColor="text-teal-400" label="Build & Deploy" offset={7}>
                            {/* Nested items */}
                            <rect x={nodePositions.build.x + 20} y={nodePositions.build.y + 50} width="160" height="35" rx="3" className="fill-background stroke-teal-400/40 pointer-events-none" strokeWidth="1" strokeDasharray="4 2" />
                            <text x={nodePositions.build.x + 100} y={nodePositions.build.y + 72} textAnchor="middle" className="fill-muted-foreground text-[11px] pointer-events-none">Serverless Functions</text>

                            <rect x={nodePositions.build.x + 20} y={nodePositions.build.y + 95} width="160" height="35" rx="3" className="fill-background stroke-teal-400/40 pointer-events-none" strokeWidth="1" strokeDasharray="4 2" />
                            <text x={nodePositions.build.x + 100} y={nodePositions.build.y + 117} textAnchor="middle" className="fill-muted-foreground text-[11px] pointer-events-none">AI Agents</text>

                            <rect x={nodePositions.build.x + 20} y={nodePositions.build.y + 140} width="160" height="35" rx="3" className="fill-background stroke-teal-400/40 pointer-events-none" strokeWidth="1" strokeDasharray="4 2" />
                            <text x={nodePositions.build.x + 100} y={nodePositions.build.y + 162} textAnchor="middle" className="fill-muted-foreground text-[11px] pointer-events-none">Custom Models</text>
                        </DraggableBox>
                    </g>

                    {/* Runtime Infrastructure */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <DraggableBox nodeId="edge" fillColor="fill-rose-400/10" strokeColor="text-rose-400" label="Edge Nodes" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
                        <DraggableBox nodeId="cpu" fillColor="fill-rose-400/10" strokeColor="text-rose-400" label="CPU Workers" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <DraggableBox nodeId="gpu" fillColor="fill-rose-400/10" strokeColor="text-rose-400" label="GPU Cluster" />
                    </g>
                    <g className="animate-fade-in" style={{ animationDelay: "0.45s" }}>
                        <DraggableBox nodeId="dedicated" fillColor="fill-rose-400/10" strokeColor="text-rose-400" label="Dedicated" />
                    </g>

                    {/* Output */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <DraggableBox nodeId="output" fillColor="fill-sky-400/10" strokeColor="text-sky-400" label="Output" sublabel="Auto-scale • Zero cold starts" offset={7} />
                    </g>
                </svg>
            </div>

            {/* ==================== MOBILE (Static) ==================== */}
            <div className="md:hidden flex flex-col items-center">
                <svg
                    viewBox="0 0 300 420"
                    className="w-full max-w-[300px] h-auto"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Deploy */}
                    <g className="animate-fade-in">
                        <rect x="78" y="18" width="150" height="50" rx="4" className="fill-violet-400/10" style={{ opacity: 0.3 }} />
                        <rect x="72" y="14" width="150" height="50" rx="4" className="fill-violet-400/10" style={{ opacity: 0.4 }} />
                        <rect x="65" y="10" width="150" height="50" rx="4" className="fill-violet-400/10 stroke-violet-400" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={65} y={10} width={150} height={50} color="text-violet-400" />
                        <text x="140" y="40" textAnchor="middle" className="fill-violet-400 text-[14px] font-medium">Deploy</text>
                    </g>

                    <AnimatedPath d="M 140 60 L 140 85" />

                    {/* Build */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                        <rect x="52" y="97" width="200" height="80" rx="4" className="fill-teal-400/10" style={{ opacity: 0.3 }} />
                        <rect x="46" y="93" width="200" height="80" rx="4" className="fill-teal-400/10" style={{ opacity: 0.4 }} />
                        <rect x="40" y="85" width="200" height="80" rx="4" className="fill-teal-400/10 stroke-teal-400" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={40} y={85} width={200} height={80} color="text-teal-400" />
                        <text x="140" y="115" textAnchor="middle" className="fill-teal-400 text-[14px] font-medium">Build</text>
                        <text x="140" y="135" textAnchor="middle" className="fill-muted-foreground text-[10px]">Functions • Agents • Models</text>
                    </g>

                    <AnimatedPath d="M 140 165 L 140 190" />

                    {/* Runtime Grid */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                        <rect x="18" y="198" width="125" height="45" rx="4" className="fill-rose-400/10" style={{ opacity: 0.4 }} />
                        <rect x="10" y="190" width="125" height="45" rx="4" className="fill-rose-400/10 stroke-rose-400" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={10} y={190} width={125} height={45} color="text-rose-400" />
                        <text x="72" y="217" textAnchor="middle" className="fill-rose-400 text-[11px]">Edge Nodes</text>

                        <rect x="168" y="198" width="125" height="45" rx="4" className="fill-rose-400/10" style={{ opacity: 0.4 }} />
                        <rect x="160" y="190" width="125" height="45" rx="4" className="fill-rose-400/10 stroke-rose-400" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={160} y={190} width={125} height={45} color="text-rose-400" />
                        <text x="222" y="217" textAnchor="middle" className="fill-rose-400 text-[11px]">GPU Cluster</text>
                    </g>

                    <g className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                        <rect x="18" y="258" width="125" height="45" rx="4" className="fill-rose-400/10" style={{ opacity: 0.4 }} />
                        <rect x="10" y="250" width="125" height="45" rx="4" className="fill-rose-400/10 stroke-rose-400" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={10} y={250} width={125} height={45} color="text-rose-400" />
                        <text x="72" y="277" textAnchor="middle" className="fill-rose-400 text-[11px]">CPU Workers</text>

                        <rect x="168" y="258" width="125" height="45" rx="4" className="fill-rose-400/10" style={{ opacity: 0.4 }} />
                        <rect x="160" y="250" width="125" height="45" rx="4" className="fill-rose-400/10 stroke-rose-400" strokeWidth="1.5" strokeDasharray="5 2" />
                        <CornerDotsMobile x={160} y={250} width={125} height={45} color="text-rose-400" />
                        <text x="222" y="277" textAnchor="middle" className="fill-rose-400 text-[11px]">Dedicated</text>
                    </g>

                    <AnimatedPath d="M 72 235 L 72 250" />
                    <AnimatedPath d="M 222 235 L 222 250" />
                    <AnimatedPath d="M 72 295 L 72 320 L 100 320 L 100 345" />
                    <AnimatedPath d="M 222 295 L 222 320 L 190 320 L 190 345" />

                    {/* Output */}
                    <g className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
                        <rect x="62" y="357" width="180" height="55" rx="4" className="fill-sky-400/10" style={{ opacity: 0.3 }} />
                        <rect x="56" y="353" width="180" height="55" rx="4" className="fill-sky-400/10" style={{ opacity: 0.4 }} />
                        <rect x="50" y="345" width="180" height="55" rx="4" className="fill-sky-400/10 stroke-sky-400" strokeWidth="1.5" strokeDasharray="6 3" />
                        <CornerDotsMobile x={50} y={345} width={180} height={55} color="text-sky-400" />
                        <text x="140" y="372" textAnchor="middle" className="fill-sky-400 text-[14px] font-medium">Output</text>
                        <text x="140" y="390" textAnchor="middle" className="fill-muted-foreground text-[10px]">Auto-scale • Zero cold starts</text>
                    </g>
                </svg>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border/30 -mx-8 px-8">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-teal-400">✓</span> Zero cold starts
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-teal-400">✓</span> Auto-scaling
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-teal-400">✓</span> Pay-per-use
                </span>
            </div>
        </div>
    );
};
