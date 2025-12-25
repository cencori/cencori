"use client";

/**
 * Geographic Map Component
 * 
 * Renders a world map with countries highlighted based on API request volume.
 * Uses react-simple-maps for SVG rendering.
 */

import { useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    ComposableMap,
    Geographies,
    Geography,
    ZoomableGroup,
} from "react-simple-maps";
import { Skeleton } from "@/components/ui/skeleton";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeoData {
    code: string;
    name: string;
    requests: number;
}

import type { TimeRange } from "./GeoAnalyticsSection";

interface GeoMapProps {
    projectId: string;
    timeRange?: TimeRange;
}

// Memoized geography component for performance
const MapGeography = memo(({
    geo,
    countryData,
    maxRequests,
    onHover,
}: {
    geo: any;
    countryData: Map<string, GeoData>;
    maxRequests: number;
    onHover: (data: { name: string; code: string; requests: number } | null) => void;
}) => {
    // Get ISO alpha-2 from geography properties
    const isoCode = geo.properties?.ISO_A2 || geo.properties?.iso_a2;
    const data = isoCode ? countryData.get(isoCode) : null;
    const hasData = data && data.requests > 0;

    // Calculate color intensity based on request volume
    const intensity = hasData ? Math.min(data.requests / maxRequests, 1) : 0;
    const fillColor = hasData
        ? `rgba(249, 115, 22, ${0.4 + intensity * 0.6})` // orange-500 with varying opacity
        : "hsl(var(--muted))"; // use muted background for countries with no data

    // Get country name for tooltip
    const countryName = geo.properties?.name || geo.properties?.NAME || isoCode || 'Unknown';

    return (
        <Geography
            geography={geo}
            onMouseEnter={() => onHover({
                code: isoCode || 'XX',
                name: countryName,
                requests: data?.requests || 0,
            })}
            onMouseLeave={() => onHover(null)}
            style={{
                default: {
                    fill: fillColor,
                    stroke: "hsl(var(--border))",
                    strokeWidth: 0.3,
                    outline: "none",
                },
                hover: {
                    fill: hasData ? `rgba(249, 115, 22, ${0.6 + intensity * 0.4})` : "rgba(249, 115, 22, 0.15)",
                    stroke: "rgb(249, 115, 22)",
                    strokeWidth: 1.5,
                    outline: "none",
                    cursor: "pointer",
                },
                pressed: {
                    fill: hasData ? "rgb(234, 88, 12)" : "rgba(249, 115, 22, 0.25)",
                    stroke: "rgb(234, 88, 12)",
                    strokeWidth: 1.5,
                    outline: "none",
                },
            }}
        />
    );
});
MapGeography.displayName = "MapGeography";

export function GeoMap({ projectId, timeRange = "7d" }: GeoMapProps) {
    const [hoveredCountry, setHoveredCountry] = useState<GeoData | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // Fetch geographic data
    const { data, isLoading } = useQuery({
        queryKey: ["geo-analytics", projectId, timeRange],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/geo?range=${timeRange}`);
            if (!res.ok) throw new Error("Failed to fetch geo data");
            return res.json();
        },
        staleTime: 60 * 1000, // 1 minute
    });

    // Create lookup map
    const countryData = new Map<string, GeoData>();
    const countries: GeoData[] = data?.countries || [];
    const maxRequests = Math.max(...countries.map(c => c.requests), 1);

    for (const country of countries) {
        countryData.set(country.code, country);
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        setTooltipPos({ x: e.clientX, y: e.clientY });
    };

    if (isLoading) {
        return <Skeleton className="w-full h-[300px] rounded-lg" />;
    }

    return (
        <div
            className="relative w-full h-[300px] bg-card rounded-lg overflow-hidden border border-border/40"
            onMouseMove={handleMouseMove}
        >
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 400,
                    center: [20, 20],
                }}
                style={{ width: "100%", height: "100%" }}
            >
                <ZoomableGroup
                    zoom={1}
                    minZoom={0.5}
                    maxZoom={8}
                >
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                            geographies.map((geo) => (
                                <MapGeography
                                    key={geo.rsmKey}
                                    geo={geo}
                                    countryData={countryData}
                                    maxRequests={maxRequests}
                                    onHover={setHoveredCountry}
                                />
                            ))
                        }
                    </Geographies>
                </ZoomableGroup>
            </ComposableMap>

            {/* Tooltip */}
            {hoveredCountry && (
                <div
                    className="fixed z-50 px-3 py-2 bg-card border border-border rounded-md shadow-lg pointer-events-none"
                    style={{
                        left: tooltipPos.x + 10,
                        top: tooltipPos.y - 40,
                    }}
                >
                    <p className="text-xs font-medium text-orange-500">{hoveredCountry.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                        {hoveredCountry.requests.toLocaleString()} requests
                    </p>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Low</span>
                <div className="w-16 h-2 rounded-full bg-gradient-to-r from-orange-500/40 to-orange-500" />
                <span>High</span>
            </div>

            {/* Stats Summary */}
            {countries.length > 0 && (
                <div className="absolute top-3 left-3 bg-card/80 backdrop-blur-sm rounded-md px-3 py-2 border border-border/40">
                    <p className="text-xs font-medium">
                        {(data?.totalRequests || 0).toLocaleString()} requests
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        from {countries.length} {countries.length === 1 ? 'country' : 'countries'}
                    </p>
                </div>
            )}
        </div>
    );
}
