'use client';

import { useQuery } from '@tanstack/react-query';
import type { LatencyBenchmark, PlatformOverviewMetrics, TimePeriod } from '../lib/types';

// Helper to get admin email from sessionStorage
function getAdminEmail(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('internal_admin_email');
}

export function usePlatformMetrics(period: TimePeriod = '7d') {
    return useQuery<PlatformOverviewMetrics>({
        queryKey: ['platformMetrics', period],
        queryFn: async () => {
            const adminEmail = getAdminEmail();
            const headers: HeadersInit = {};
            if (adminEmail) {
                headers['X-Admin-Email'] = adminEmail;
            }

            const response = await fetch(`/api/internal/metrics/overview?period=${period}`, { headers });
            if (!response.ok) throw new Error('Failed to fetch platform metrics');
            return response.json();
        },
        staleTime: 2 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });
}

/** Gateway latency by country, Vercel (before the move) vs Lagos (after). */
export function useGatewayLatency() {
    return useQuery<LatencyBenchmark>({
        queryKey: ['gatewayLatency'],
        queryFn: async () => {
            const response = await fetch('/api/internal/metrics/latency');
            if (!response.ok) throw new Error('Failed to fetch gateway latency');
            return response.json();
        },
        staleTime: 2 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });
}

