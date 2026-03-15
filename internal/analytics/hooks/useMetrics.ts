'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlatformOverviewMetrics, PlatformEventEntry, TimePeriod } from '../lib/types';

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

interface PlatformEventsFilters {
    product?: string;
    event_type?: string;
    user_id?: string;
    org_id?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}

interface PlatformEventsResponse {
    events: PlatformEventEntry[];
    total: number;
    page: number;
    limit: number;
}

export function usePlatformEvents(filters: PlatformEventsFilters = {}) {
    return useQuery<PlatformEventsResponse>({
        queryKey: ['platformEvents', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.product) params.set('product', filters.product);
            if (filters.event_type) params.set('event_type', filters.event_type);
            if (filters.user_id) params.set('user_id', filters.user_id);
            if (filters.org_id) params.set('org_id', filters.org_id);
            if (filters.from) params.set('from', filters.from);
            if (filters.to) params.set('to', filters.to);
            if (filters.page) params.set('page', String(filters.page));
            if (filters.limit) params.set('limit', String(filters.limit));

            const response = await fetch(`/api/internal/events?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch platform events');
            return response.json();
        },
        staleTime: 5 * 1000,
        refetchInterval: 5 * 1000,
    });
}
