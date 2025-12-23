'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlatformOverviewMetrics, TimePeriod } from '../lib/types';

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
        staleTime: 5 * 1000, // 5 seconds
        refetchInterval: 10 * 1000, // Auto-refresh every 10 seconds for near real-time
    });
}

export function useAIGatewayMetrics(period: TimePeriod = '7d') {
    return useQuery({
        queryKey: ['aiGatewayMetrics', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/ai-gateway?period=${period}`);
            if (!response.ok) throw new Error('Failed to fetch AI Gateway metrics');
            return response.json();
        },
        staleTime: 30 * 1000,
    });
}

export function useSecurityMetrics(period: TimePeriod = '7d') {
    return useQuery({
        queryKey: ['securityMetrics', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/security?period=${period}`);
            if (!response.ok) throw new Error('Failed to fetch security metrics');
            return response.json();
        },
        staleTime: 30 * 1000,
    });
}

export function useOrganizationsMetrics(period: TimePeriod = '7d') {
    return useQuery({
        queryKey: ['organizationsMetrics', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/organizations?period=${period}`);
            if (!response.ok) throw new Error('Failed to fetch organizations metrics');
            return response.json();
        },
        staleTime: 60 * 1000,
    });
}

export function useProjectsMetrics(period: TimePeriod = '7d') {
    return useQuery({
        queryKey: ['projectsMetrics', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/projects?period=${period}`);
            if (!response.ok) throw new Error('Failed to fetch projects metrics');
            return response.json();
        },
        staleTime: 60 * 1000,
    });
}

export function useApiKeysMetrics(period: TimePeriod = '7d') {
    return useQuery({
        queryKey: ['apiKeysMetrics', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/api-keys?period=${period}`);
            if (!response.ok) throw new Error('Failed to fetch API keys metrics');
            return response.json();
        },
        staleTime: 60 * 1000,
    });
}

export function useUsersMetrics() {
    return useQuery({
        queryKey: ['usersMetrics'],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/users`);
            if (!response.ok) throw new Error('Failed to fetch users metrics');
            return response.json();
        },
        staleTime: 60 * 1000,
    });
}
