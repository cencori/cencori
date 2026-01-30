import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TelemetryPayload {
    event: string;
    version: string;
    platform: string;
    filesScanned: number;
    issuesFound: number;
    score: string;
    hasApiKey: boolean;
    scanDuration: number;
    issueBreakdown?: {
        secrets?: number;
        pii?: number;
        routes?: number;
        config?: number;
        vulnerabilities?: number;
    };
}

export async function POST(request: NextRequest) {
    try {
        const payload: TelemetryPayload = await request.json();

        // Validate required fields
        if (!payload.event || !payload.version) {
            return NextResponse.json(
                { error: 'Invalid payload' },
                {
                    status: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                }
            );
        }

        // Insert telemetry data
        const { error } = await supabase.from('scan_telemetry').insert({
            event: payload.event,
            version: payload.version,
            platform: payload.platform || 'unknown',
            files_scanned: payload.filesScanned || 0,
            issues_found: payload.issuesFound || 0,
            score: payload.score || 'unknown',
            has_api_key: payload.hasApiKey || false,
            scan_duration_ms: payload.scanDuration || 0,
            secrets_count: payload.issueBreakdown?.secrets || 0,
            pii_count: payload.issueBreakdown?.pii || 0,
            routes_count: payload.issueBreakdown?.routes || 0,
            config_count: payload.issueBreakdown?.config || 0,
            vulnerabilities_count: payload.issueBreakdown?.vulnerabilities || 0,
        });

        if (error) {
            console.error('Telemetry insert error:', error);
            // Don't return error to client - just log it
        }

        return NextResponse.json(
            { success: true },
            {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    } catch (error) {
        console.error('Telemetry error:', error);
        // Always return success - telemetry should never fail for the client
        return NextResponse.json(
            { success: true },
            {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }
}

// Allow CORS for CLI requests
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
