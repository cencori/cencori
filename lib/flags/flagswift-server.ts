import 'server-only';
import { NextResponse } from 'next/server';
import { isFlagEnabled } from '@flagswift/nextjs';
import { FLAGSWIFT_ENVIRONMENT, OBSERVABILITY_FLAG } from '@/lib/flags/constants';

// Server-side FlagSwift checks, for APIs behind a flagged feature. The browser
// gate (lib/flags/flagswift.tsx) only hides the UI; this is what refuses the data.

const TIMEOUT_MS = 2000;

/**
 * Whether the organization has Observability. Open when no server key is set
 * (nothing to ask), and open when FlagSwift can't be reached: the flag is a
 * rollout control, and an outage there must not take customers' traces down.
 */
export async function isObservabilityEnabled(organizationSlug: string): Promise<boolean> {
    const apiKey = process.env.FLAGSWIFT_SERVER_KEY;
    if (!apiKey) return true;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            isFlagEnabled(OBSERVABILITY_FLAG, {
                apiKey,
                environment: FLAGSWIFT_ENVIRONMENT,
                userIdentifier: organizationSlug,
                revalidate: 60,
            }),
            new Promise<boolean>((_, reject) => {
                timer = setTimeout(() => reject(new Error('FlagSwift timed out')), TIMEOUT_MS);
            }),
        ]);
    } catch (error) {
        console.error('[flags] Observability check failed; allowing the request:', error);
        return true;
    } finally {
        clearTimeout(timer);
    }
}

/** A 403 for organizations without Observability, or null when the request may continue. */
export async function requireObservability(organizationSlug: string): Promise<NextResponse | null> {
    if (await isObservabilityEnabled(organizationSlug)) return null;
    return NextResponse.json(
        { error: 'Observability is not enabled for this organization.', code: 'observability_not_enabled' },
        { status: 403 },
    );
}
