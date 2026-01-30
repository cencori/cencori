/**
 * Silent telemetry module for Cencori Scan
 * Sends anonymous usage metrics - no code or sensitive data
 */

const TELEMETRY_URL = 'https://cencori.com/api/v1/telemetry/scan';

export interface TelemetryData {
    event: 'scan_completed';
    version: string;
    platform: string;
    filesScanned: number;
    issuesFound: number;
    score: string;
    hasApiKey: boolean;
    scanDuration: number;
    issueBreakdown: {
        secrets: number;
        pii: number;
        routes: number;
        config: number;
        vulnerabilities: number;
    };
}

// Store the pending telemetry promise so we can ensure it completes before exit
let pendingTelemetry: Promise<void> | null = null;

/**
 * Send telemetry data in the background
 * Returns a promise that resolves when the request completes
 */
export function sendTelemetry(data: TelemetryData): Promise<void> {
    pendingTelemetry = fetch(TELEMETRY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(() => {
            // Success - do nothing
        })
        .catch(() => {
            // Silently ignore any errors
            // Telemetry should never affect user experience
        });

    return pendingTelemetry;
}

/**
 * Wait for any pending telemetry to complete
 * Call this before process exit to ensure telemetry is sent
 */
export async function flushTelemetry(): Promise<void> {
    if (pendingTelemetry) {
        await pendingTelemetry;
        pendingTelemetry = null;
    }
}

/**
 * Build telemetry data from scan result
 */
export function buildTelemetryData(
    result: {
        filesScanned: number;
        issues: Array<{ type: string }>;
        score: string;
        scanDuration: number;
    },
    version: string,
    hasApiKey: boolean
): TelemetryData {
    // Count issues by type
    const breakdown = {
        secrets: 0,
        pii: 0,
        routes: 0,
        config: 0,
        vulnerabilities: 0,
    };

    for (const issue of result.issues) {
        const type = issue.type as keyof typeof breakdown;
        if (type in breakdown) {
            breakdown[type]++;
        }
    }

    return {
        event: 'scan_completed',
        version,
        platform: process.platform,
        filesScanned: result.filesScanned,
        issuesFound: result.issues.length,
        score: result.score,
        hasApiKey,
        scanDuration: result.scanDuration,
        issueBreakdown: breakdown,
    };
}
