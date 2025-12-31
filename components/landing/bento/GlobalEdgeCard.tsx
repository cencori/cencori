"use client";

import React, { useRef, useEffect, useState } from "react";
import { BentoCard } from "./BentoCard";
import createGlobe from "cobe";
import { useTheme } from "next-themes";

// Edge node locations (lat, lng)
const edgeNodes = [
    { name: "Virginia", location: [37.4, -79.0] },
    { name: "London", location: [51.5, -0.1] },
    { name: "Frankfurt", location: [50.1, 8.7] },
    { name: "Tokyo", location: [35.7, 139.7] },
    { name: "Sydney", location: [-33.9, 151.2] },
    { name: "São Paulo", location: [-23.5, -46.6] },
    { name: "Singapore", location: [1.3, 103.8] },
    { name: "Mumbai", location: [19.0, 72.9] },
    { name: "Paris", location: [48.9, 2.4] },
    { name: "Toronto", location: [43.7, -79.4] },
    { name: "Seoul", location: [37.6, 127.0] },
    { name: "Amsterdam", location: [52.4, 4.9] },
];

export const GlobalEdgeCard = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [activeNodeIndex, setActiveNodeIndex] = useState(0);
    const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
    const phiRef = useRef(0);
    const { resolvedTheme } = useTheme();

    const isDark = resolvedTheme === "dark";

    useEffect(() => {
        let width = 0;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onResize = () => {
            if (canvas) {
                width = canvas.offsetWidth;
            }
        };
        window.addEventListener("resize", onResize);
        onResize();

        // Create markers from edge nodes with green color
        const markers = edgeNodes.map((node, index) => ({
            location: node.location as [number, number],
            size: index === activeNodeIndex && isHovered ? 0.1 : 0.05,
        }));

        // Theme-aware colors
        const baseColor: [number, number, number] = isDark ? [0.1, 0.1, 0.1] : [0.9, 0.9, 0.9];
        const glowColor: [number, number, number] = isDark ? [0.02, 0.15, 0.1] : [0.8, 0.95, 0.9];

        globeRef.current = createGlobe(canvas, {
            devicePixelRatio: 2,
            width: width * 2,
            height: width * 2,
            phi: 0,
            theta: 0.3,
            dark: isDark ? 1 : 0,
            diffuse: 1.2,
            mapSamples: 21000,
            mapBrightness: isDark ? 12.0 : 6.0,
            baseColor,
            markerColor: [0.063, 0.725, 0.506], // Emerald green
            glowColor,
            markers,
            onRender: (state) => {
                // Rotate faster when hovered
                state.phi = phiRef.current;
                phiRef.current += isHovered ? 0.02 : 0.005;
                state.width = width * 2;
                state.height = width * 2;
            },
        });

        return () => {
            globeRef.current?.destroy();
            window.removeEventListener("resize", onResize);
        };
    }, [isHovered, activeNodeIndex, isDark]);

    // Cycle through active nodes when hovered
    useEffect(() => {
        if (isHovered) {
            const interval = setInterval(() => {
                setActiveNodeIndex((prev) => (prev + 1) % edgeNodes.length);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isHovered]);

    return (
        <div
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <BentoCard
                title="Global Edge"
                description="12+ edge locations. Deploy close to your users."
                accentColor="green"
            >
                <div className="relative w-full flex items-center justify-center overflow-hidden -mt-2">
                    {/* COBE Globe Canvas */}
                    <canvas
                        ref={canvasRef}
                        className="w-full h-full max-w-[320px] max-h-[320px] md:max-w-[280px] md:max-h-[280px]"
                        style={{
                            contain: "layout paint size",
                            opacity: 1,
                            transition: "opacity 0.3s ease",
                            aspectRatio: "1 / 1",
                        }}
                    />

                    {/* Gradient overlays for seamless blending */}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-b from-card/50 via-transparent to-transparent pointer-events-none" />

                    {/* Active location label */}
                    {isHovered && (
                        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs text-emerald-400 font-medium">
                                    {edgeNodes[activeNodeIndex].name}
                                </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {edgeNodes.length} regions
                            </span>
                        </div>
                    )}
                </div>
            </BentoCard>
        </div>
    );
};
