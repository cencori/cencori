"use client";

/**
 * Geographic Map Component
 *
 * Custom SVG world map using d3-geo projections.
 * No external tile servers — everything renders locally from bundled topology.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeRange } from "./GeoAnalyticsSection";

// ISO numeric → alpha-2 mapping for world-atlas topology
const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
    "4": "AF", "8": "AL", "12": "DZ", "24": "AO", "32": "AR", "36": "AU",
    "40": "AT", "44": "BS", "48": "BH", "50": "BD", "51": "AM", "56": "BE",
    "64": "BT", "68": "BO", "70": "BA", "72": "BW", "76": "BR", "96": "BN",
    "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH", "120": "CM",
    "124": "CA", "140": "CF", "144": "LK", "148": "TD", "152": "CL", "156": "CN",
    "158": "TW", "170": "CO", "178": "CG", "180": "CD", "188": "CR", "191": "HR",
    "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "214": "DO",
    "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE",
    "242": "FJ", "246": "FI", "250": "FR", "262": "DJ", "266": "GA", "268": "GE",
    "270": "GM", "275": "PS", "276": "DE", "288": "GH", "300": "GR", "320": "GT",
    "324": "GN", "328": "GY", "332": "HT", "340": "HN", "344": "HK", "348": "HU",
    "352": "IS", "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE",
    "376": "IL", "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ",
    "400": "JO", "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG",
    "418": "LA", "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY",
    "440": "LT", "442": "LU", "450": "MG", "454": "MW", "458": "MY", "462": "MV",
    "466": "ML", "470": "MT", "478": "MR", "480": "MU", "484": "MX", "496": "MN",
    "498": "MD", "499": "ME", "504": "MA", "508": "MZ", "512": "OM", "516": "NA",
    "524": "NP", "528": "NL", "554": "NZ", "558": "NI", "562": "NE", "566": "NG",
    "578": "NO", "586": "PK", "591": "PA", "598": "PG", "600": "PY", "604": "PE",
    "608": "PH", "616": "PL", "620": "PT", "624": "GW", "634": "QA", "642": "RO",
    "643": "RU", "646": "RW", "682": "SA", "686": "SN", "688": "RS", "694": "SL",
    "702": "SG", "703": "SK", "704": "VN", "705": "SI", "706": "SO", "710": "ZA",
    "716": "ZW", "724": "ES", "728": "SS", "729": "SD", "740": "SR", "748": "SZ",
    "752": "SE", "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG",
    "780": "TT", "784": "AE", "788": "TN", "792": "TR", "795": "TM", "800": "UG",
    "804": "UA", "807": "MK", "818": "EG", "826": "GB", "834": "TZ", "840": "US",
    "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "887": "YE", "894": "ZM",
};

interface GeoData {
    code: string;
    name: string;
    requests: number;
    tokens: number;
    cost: number;
}

interface GeoMapProps {
    projectId: string;
    timeRange?: TimeRange;
}

interface TooltipState {
    x: number;
    y: number;
    name: string;
    code: string;
    requests: number;
}

export function GeoMap({ projectId, timeRange = "7d" }: GeoMapProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [topology, setTopology] = useState<Topology | null>(null);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    // Load topology once
    useEffect(() => {
        fetch("/world-110m.json")
            .then((res) => res.json())
            .then((topo) => setTopology(topo))
            .catch((err) => console.error("[GeoMap] Failed to load topology:", err));
    }, []);

    // Fetch geographic data
    const { data, isLoading } = useQuery({
        queryKey: ["geo-analytics", projectId, timeRange],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/geo?range=${timeRange}`);
            if (!res.ok) throw new Error("Failed to fetch geo data");
            return res.json();
        },
        staleTime: 60 * 1000,
    });

    // Build country data lookup
    const countryDataMap = useMemo(() => {
        const map = new Map<string, GeoData>();
        for (const country of (data?.countries || []) as GeoData[]) {
            map.set(country.code, country);
        }
        return map;
    }, [data]);

    const countries: GeoData[] = data?.countries || [];
    const totalRequests = countries.reduce((sum: number, c: GeoData) => sum + c.requests, 0);
    const countryCount = countries.filter((c: GeoData) => c.code !== "XX").length;
    const maxRequests = Math.max(...countries.map((c: GeoData) => c.requests), 1);

    // Projection & path generator
    const width = 900;
    const height = 440;
    const projection = useMemo(
        () => geoNaturalEarth1().scale(250).translate([width / 2, height / 1.5]),
        []
    );
    const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

    // Convert topology to GeoJSON features
    const geoFeatures = useMemo(() => {
        if (!topology) return [];
        const countriesGeo = topology.objects.countries as GeometryCollection;
        const fc = feature(topology, countriesGeo);
        return fc.features;
    }, [topology]);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent, name: string, code: string, requests: number) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            setTooltip({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                name,
                code,
                requests,
            });
        },
        []
    );

    const handleMouseLeave = useCallback(() => {
        setTooltip(null);
        setHoveredId(null);
    }, []);

    // Zoom with scroll wheel
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom((prev) => {
            const delta = e.deltaY > 0 ? 0.95 : 1.05;
            return Math.min(Math.max(prev * delta, 1), 6);
        });
    }, []);

    // Pan with mouse drag
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }, [pan]);

    const handlePanMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan({ x: panStart.current.panX + dx / zoom, y: panStart.current.panY + dy / zoom });
    }, [isPanning, zoom]);

    const handleMouseUp = useCallback(() => setIsPanning(false), []);

    // Reset zoom on double click
    const handleDoubleClick = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    if (isLoading || !topology) {
        return <Skeleton className="w-full h-[300px] rounded-lg" />;
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full bg-card rounded-lg overflow-hidden border border-border/40 select-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handlePanMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { handleMouseUp(); handleMouseLeave(); }}
            onDoubleClick={handleDoubleClick}
            style={{ cursor: isPanning ? "grabbing" : "grab" }}
        >
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full"
                style={{ background: "transparent" }}
            >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: `${width / 2}px ${height / 2}px` }}>
                    {/* Country paths */}
                    {geoFeatures.map((feat) => {
                        const numericId = String(feat.id);
                        const isoCode = ISO_NUMERIC_TO_ALPHA2[numericId] || null;
                        const countryInfo = isoCode ? countryDataMap.get(isoCode) : null;
                        const hasData = countryInfo && countryInfo.requests > 0;
                        const intensity = hasData ? Math.min(countryInfo.requests / maxRequests, 1) : 0;
                        const isHovered = hoveredId === numericId;
                        const name = (feat.properties as Record<string, string>)?.name || isoCode || "Unknown";

                        let fillColor: string;
                        if (isHovered) {
                            fillColor = hasData
                                ? `rgba(249, 115, 22, ${0.5 + intensity * 0.5})`
                                : "rgba(255, 255, 255, 0.15)";
                        } else {
                            fillColor = hasData
                                ? `rgba(249, 115, 22, ${0.25 + intensity * 0.65})`
                                : "rgba(255, 255, 255, 0.06)";
                        }

                        const d = pathGenerator(feat as GeoPermissibleObjects);
                        if (!d) return null;

                        return (
                            <path
                                key={numericId}
                                d={d}
                                fill={fillColor}
                                stroke={isHovered ? "rgba(249, 115, 22, 0.6)" : "rgba(255, 255, 255, 0.1)"}
                                strokeWidth={isHovered ? 1.5 / zoom : 0.5 / zoom}
                                className="transition-colors duration-150"
                                onMouseMove={(e) => {
                                    setHoveredId(numericId);
                                    handleMouseMove(e, name, isoCode || "XX", countryInfo?.requests || 0);
                                }}
                                onMouseLeave={handleMouseLeave}
                            />
                        );
                    })}
                </g>
            </svg>

            {/* Zoom level indicator */}
            {zoom > 1 && (
                <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] text-muted-foreground">
                    {zoom.toFixed(1)}x — double-click to reset
                </div>
            )}

            {/* Stats overlay */}
            <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 text-xs">
                <span className="font-semibold text-orange-500">
                    {totalRequests.toLocaleString()} requests
                </span>
                <span className="text-muted-foreground">
                    {" "}from {countryCount} {countryCount === 1 ? "country" : "countries"}
                </span>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Low</span>
                <div className="w-16 h-2 rounded-full bg-gradient-to-r from-orange-500/30 to-orange-500" />
                <span>High</span>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="absolute z-50 bg-popover text-popover-foreground shadow-lg rounded-md px-3 py-2 text-xs pointer-events-none border"
                    style={{
                        left: Math.min(tooltip.x + 12, width - 140),
                        top: tooltip.y - 40,
                    }}
                >
                    <div className="font-medium">{tooltip.name}</div>
                    {tooltip.requests > 0 ? (
                        <div className="text-orange-500">{tooltip.requests.toLocaleString()} requests</div>
                    ) : (
                        <div className="text-muted-foreground">No requests</div>
                    )}
                </div>
            )}
        </div>
    );
}
