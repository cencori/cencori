"use client";

/**
 * Geographic Map Component
 * 
 * Renders a world map with countries highlighted based on API request volume.
 * Uses react-simple-maps for SVG rendering.
 * 
 * IMPORTANT: world-atlas countries-110m.json uses numeric ISO 3166-1 IDs (e.g., "840" for USA),
 * NOT ISO alpha-2 codes. We need a mapping from numeric ID to alpha-2 code.
 */

import { useState, memo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
    ComposableMap,
    Geographies,
    Geography,
    ZoomableGroup,
} from "react-simple-maps";
import { Skeleton } from "@/components/ui/skeleton";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Mapping from ISO 3166-1 numeric ID to alpha-2 code
// world-atlas uses numeric IDs in the `id` property
const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
    "4": "AF", "8": "AL", "12": "DZ", "20": "AD", "24": "AO", "28": "AG", "32": "AR",
    "36": "AU", "40": "AT", "44": "BS", "48": "BH", "50": "BD", "51": "AM", "52": "BB",
    "56": "BE", "60": "BM", "64": "BT", "68": "BO", "70": "BA", "72": "BW", "76": "BR",
    "84": "BZ", "90": "SB", "96": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY",
    "116": "KH", "120": "CM", "124": "CA", "132": "CV", "140": "CF", "144": "LK", "148": "TD",
    "152": "CL", "156": "CN", "158": "TW", "170": "CO", "174": "KM", "178": "CG", "180": "CD",
    "188": "CR", "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK",
    "212": "DM", "214": "DO", "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER",
    "233": "EE", "242": "FJ", "246": "FI", "250": "FR", "262": "DJ", "266": "GA", "268": "GE",
    "270": "GM", "275": "PS", "276": "DE", "288": "GH", "296": "KI", "300": "GR", "308": "GD",
    "316": "GU", "320": "GT", "324": "GN", "328": "GY", "332": "HT", "336": "VA", "340": "HN",
    "344": "HK", "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR", "368": "IQ",
    "372": "IE", "376": "IL", "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ",
    "400": "JO", "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG", "418": "LA",
    "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY", "438": "LI", "440": "LT",
    "442": "LU", "450": "MG", "454": "MW", "458": "MY", "462": "MV", "466": "ML", "470": "MT",
    "478": "MR", "480": "MU", "484": "MX", "492": "MC", "496": "MN", "498": "MD", "499": "ME",
    "504": "MA", "508": "MZ", "512": "OM", "516": "NA", "520": "NR", "524": "NP", "528": "NL",
    "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "578": "NO",
    "583": "FM", "586": "PK", "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH",
    "616": "PL", "620": "PT", "624": "GW", "626": "TL", "630": "PR", "634": "QA", "642": "RO",
    "643": "RU", "646": "RW", "659": "KN", "662": "LC", "670": "VC", "674": "SM", "678": "ST",
    "682": "SA", "686": "SN", "688": "RS", "690": "SC", "694": "SL", "702": "SG", "703": "SK",
    "704": "VN", "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "720": "YE", "724": "ES",
    "728": "SS", "729": "SD", "732": "EH", "740": "SR", "748": "SZ", "752": "SE", "756": "CH",
    "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "776": "TO", "780": "TT", "784": "AE",
    "788": "TN", "792": "TR", "795": "TM", "798": "TV", "800": "UG", "804": "UA", "807": "MK",
    "818": "EG", "826": "GB", "834": "TZ", "840": "US", "854": "BF", "858": "UY", "860": "UZ",
    "862": "VE", "876": "WF", "882": "WS", "887": "YE", "894": "ZM",
    // Additional territories
    "-99": "XX", // Unknown/disputed territories in world-atlas
};

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
    baseColor,
}: {
    geo: any;
    countryData: Map<string, GeoData>;
    maxRequests: number;
    onHover: (data: { name: string; code: string; requests: number } | null) => void;
    baseColor: string;
}) => {
    // Get ISO alpha-2 from numeric ID using our mapping
    const numericId = geo.id || geo.properties?.id;
    const isoCode = ISO_NUMERIC_TO_ALPHA2[numericId] || null;
    const data = isoCode ? countryData.get(isoCode) : null;
    const hasData = data && data.requests > 0;

    // Calculate color intensity based on request volume
    const intensity = hasData ? Math.min(data.requests / maxRequests, 1) : 0;
    const fillColor = hasData
        ? `rgba(249, 115, 22, ${0.4 + intensity * 0.6})` // orange-500 with varying opacity
        : baseColor;

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
    const { theme } = useTheme();
    const [hoveredCountry, setHoveredCountry] = useState<GeoData | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Base color for no-data countries (Theme aware RGB)
    // Dark: rgb(55, 65, 81) - gray-700
    // Light: rgb(229, 231, 235) - gray-200
    const baseColor = mounted && theme === 'light' ? "rgb(229, 231, 235)" : "rgb(55, 65, 81)";

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

    // Calculate totals for display
    const totalRequests = countries.reduce((sum, c) => sum + c.requests, 0);
    const countryCount = countries.filter(c => c.code !== 'XX').length;

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
                                    baseColor={baseColor}
                                />
                            ))
                        }
                    </Geographies>
                </ZoomableGroup>
            </ComposableMap>

            {/* Stats overlay */}
            <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 text-xs">
                <span className="font-semibold text-orange-500">{totalRequests.toLocaleString()} requests</span>
                <span className="text-muted-foreground"> from {countryCount} {countryCount === 1 ? 'country' : 'countries'}</span>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Low</span>
                <div className="w-16 h-2 rounded-full bg-gradient-to-r from-orange-500/40 to-orange-500" />
                <span>High</span>
            </div>

            {/* Tooltip */}
            {hoveredCountry && (
                <div
                    className="fixed z-50 bg-popover text-popover-foreground shadow-lg rounded-md px-3 py-2 text-xs pointer-events-none border"
                    style={{
                        left: tooltipPos.x + 10,
                        top: tooltipPos.y + 10,
                    }}
                >
                    <div className="font-medium">{hoveredCountry.name}</div>
                    <div className="text-orange-500">{hoveredCountry.requests.toLocaleString()} requests</div>
                </div>
            )}
        </div>
    );
}
