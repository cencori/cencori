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

interface GeoMapProps {
    projectId: string;
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
    onHover: (data: GeoData | null) => void;
}) => {
    // Get ISO alpha-2 from geography properties
    const isoCode = geo.properties?.ISO_A2 || geo.properties?.iso_a2;
    const data = isoCode ? countryData.get(isoCode) : null;
    const hasData = data && data.requests > 0;

    // Calculate color intensity based on request volume
    const intensity = hasData ? Math.min(data.requests / maxRequests, 1) : 0;
    const fillColor = hasData
        ? `rgba(16, 185, 129, ${0.3 + intensity * 0.7})` // emerald-500 with varying opacity
        : "#374151"; // gray-700 for countries with no data

    return (
        <Geography
            geography={geo}
            onMouseEnter={() => data && onHover(data)}
            onMouseLeave={() => onHover(null)}
            style={{
                default: {
                    fill: fillColor,
                    stroke: "#1f2937",
                    strokeWidth: 0.5,
                    outline: "none",
                },
                hover: {
                    fill: hasData ? "rgb(16, 185, 129)" : "#4b5563",
                    stroke: "#1f2937",
                    strokeWidth: 0.5,
                    outline: "none",
                    cursor: hasData ? "pointer" : "default",
                },
                pressed: {
                    fill: hasData ? "rgb(5, 150, 105)" : "#4b5563",
                    outline: "none",
                },
            }}
        />
    );
});
MapGeography.displayName = "MapGeography";

export function GeoMap({ projectId }: GeoMapProps) {
    const [hoveredCountry, setHoveredCountry] = useState<GeoData | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // Fetch geographic data
    const { data, isLoading } = useQuery({
        queryKey: ["geo-analytics", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/geo`);
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
            className="relative w-full h-[300px] bg-gray-900 rounded-lg overflow-hidden"
            onMouseMove={handleMouseMove}
        >
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 120,
                    center: [0, 20],
                }}
                style={{ width: "100%", height: "100%" }}
            >
                <ZoomableGroup>
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
                    className="fixed z-50 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg pointer-events-none"
                    style={{
                        left: tooltipPos.x + 10,
                        top: tooltipPos.y - 40,
                    }}
                >
                    <p className="text-xs font-medium text-emerald-400">{hoveredCountry.name}</p>
                    <p className="text-[10px] text-gray-400">
                        {hoveredCountry.requests.toLocaleString()} requests
                    </p>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[10px] text-gray-400">
                <span>Low</span>
                <div className="w-16 h-2 rounded-full bg-gradient-to-r from-emerald-500/30 to-emerald-500" />
                <span>High</span>
            </div>

            {/* Stats Summary */}
            {countries.length > 0 && (
                <div className="absolute top-3 left-3 bg-gray-800/80 backdrop-blur-sm rounded-md px-3 py-2">
                    <p className="text-xs font-medium text-white">
                        {(data?.totalRequests || 0).toLocaleString()} requests
                    </p>
                    <p className="text-[10px] text-gray-400">
                        from {countries.length} {countries.length === 1 ? 'country' : 'countries'}
                    </p>
                </div>
            )}
        </div>
    );
}
