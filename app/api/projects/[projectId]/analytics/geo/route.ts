import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Country name mapping (ISO 3166-1 alpha-2 to full name)
const COUNTRY_NAMES: Record<string, string> = {
    US: 'United States', NG: 'Nigeria', GB: 'United Kingdom', DE: 'Germany',
    FR: 'France', CA: 'Canada', AU: 'Australia', IN: 'India', BR: 'Brazil',
    JP: 'Japan', KR: 'South Korea', SG: 'Singapore', NL: 'Netherlands',
    SE: 'Sweden', CH: 'Switzerland', ES: 'Spain', IT: 'Italy', MX: 'Mexico',
    AR: 'Argentina', ZA: 'South Africa', AE: 'United Arab Emirates', IL: 'Israel',
    PL: 'Poland', RU: 'Russia', CN: 'China', HK: 'Hong Kong', TW: 'Taiwan',
    TH: 'Thailand', MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines', VN: 'Vietnam',
    PK: 'Pakistan', BD: 'Bangladesh', EG: 'Egypt', KE: 'Kenya', GH: 'Ghana',
    CO: 'Colombia', CL: 'Chile', PE: 'Peru', AT: 'Austria', BE: 'Belgium',
    DK: 'Denmark', FI: 'Finland', NO: 'Norway', IE: 'Ireland', NZ: 'New Zealand',
    PT: 'Portugal', CZ: 'Czech Republic', RO: 'Romania', HU: 'Hungary', UA: 'Ukraine',
};

interface GeoData {
    code: string;
    name: string;
    requests: number;
}

/**
 * GET /api/projects/[projectId]/analytics/geo
 * Returns geographic distribution of API requests
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const supabase = createAdminClient();

        // Get request counts by country
        const { data, error } = await supabase
            .from('ai_requests')
            .select('country_code')
            .eq('project_id', projectId)
            .not('country_code', 'is', null);

        if (error) {
            console.error('Error fetching geo data:', error);
            return NextResponse.json({ error: 'Failed to fetch geo data' }, { status: 500 });
        }

        // Aggregate by country
        const countryMap = new Map<string, number>();
        for (const row of data || []) {
            if (row.country_code) {
                const count = countryMap.get(row.country_code) || 0;
                countryMap.set(row.country_code, count + 1);
            }
        }

        // Convert to array and sort by request count
        const countries: GeoData[] = Array.from(countryMap.entries())
            .map(([code, requests]) => ({
                code,
                name: COUNTRY_NAMES[code] || code,
                requests,
            }))
            .sort((a, b) => b.requests - a.requests);

        const totalRequests = countries.reduce((sum, c) => sum + c.requests, 0);

        return NextResponse.json({
            countries,
            totalRequests,
        });
    } catch (error) {
        console.error('Geo analytics error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
