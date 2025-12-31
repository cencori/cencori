/**
 * API endpoint to get circuit breaker states
 * Used by the dashboard to show provider health
 */

import { NextResponse } from 'next/server';
import { getAllCircuitStates, getCircuitStatus } from '@/lib/providers/circuit-breaker';

// Known providers list
const KNOWN_PROVIDERS = [
    'openai',
    'anthropic',
    'google',
    'mistral',
    'xai',
    'deepseek',
    'cohere',
    'groq',
    'perplexity',
];

export async function GET() {
    try {
        // Get all known circuit states
        const memoryStates = getAllCircuitStates();

        // Build status for all known providers
        const providerStatuses = await Promise.all(
            KNOWN_PROVIDERS.map(async (provider) => {
                // Check if we have a state in memory
                const memoryState = memoryStates[provider];

                if (memoryState) {
                    return {
                        provider,
                        state: memoryState.state,
                        failures: memoryState.failures,
                        lastFailure: memoryState.lastFailure,
                        lastSuccess: memoryState.lastSuccess,
                    };
                }

                // Try to get from Redis if available
                const state = await getCircuitStatus(provider);

                return {
                    provider,
                    state: state.state,
                    failures: state.failures,
                    lastFailure: state.lastFailure,
                    lastSuccess: state.lastSuccess,
                };
            })
        );

        // Calculate summary
        const openCircuits = providerStatuses.filter(p => p.state === 'open').length;
        const halfOpenCircuits = providerStatuses.filter(p => p.state === 'half-open').length;
        const healthyCircuits = providerStatuses.filter(p => p.state === 'closed').length;

        return NextResponse.json({
            providers: providerStatuses,
            summary: {
                total: KNOWN_PROVIDERS.length,
                healthy: healthyCircuits,
                degraded: halfOpenCircuits,
                down: openCircuits,
            },
        });
    } catch (error) {
        console.error('[API] Error fetching circuit states:', error);
        return NextResponse.json(
            { error: 'Failed to fetch circuit states' },
            { status: 500 }
        );
    }
}
