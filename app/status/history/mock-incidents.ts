// TEMPORARY design fixtures for /status/history. Used in development only
// (see page.tsx). Delete this file and its two references once real incidents
// exist to design against.

import type { OutrayIncident } from '@/lib/outray-status';

export const MOCK_INCIDENTS: OutrayIncident[] = [
  {
    id: 'mock-1',
    title: 'Elevated error rates on the AI Gateway',
    impact: 'minor',
    status: 'resolved',
    startedAt: '2026-10-21T12:34:00Z',
    updates: [{ status: 'resolved', body: 'All impacted services have now fully recovered.' }],
  },
  {
    id: 'mock-2',
    title: 'Increased latency for streaming responses',
    impact: 'minor',
    status: 'resolved',
    startedAt: '2026-10-21T09:44:00Z',
    updates: [{ status: 'resolved', body: 'All impacted services have now fully recovered.' }],
  },
  {
    id: 'mock-3',
    title: 'Console unavailable for some organizations',
    impact: 'major',
    status: 'resolved',
    startedAt: '2026-10-20T20:28:00Z',
    updates: [
      {
        status: 'resolved',
        body: 'We identified a misconfigured deploy and rolled it back. Sign-in and project pages are working normally again.',
      },
    ],
  },
  {
    id: 'mock-4',
    title: 'Scheduled database maintenance',
    impact: 'maintenance',
    status: 'completed',
    startedAt: '2026-10-16T03:00:00Z',
    updates: [{ status: 'completed', body: 'The scheduled maintenance has been completed.' }],
  },
  {
    id: 'mock-5',
    title: 'Degraded performance for image generation, vision and document extraction across several upstream providers',
    impact: 'minor',
    status: 'resolved',
    startedAt: '2026-10-14T03:58:00Z',
    updates: [{ status: 'resolved', body: 'All impacted services have now fully recovered.' }],
  },
  {
    id: 'mock-6',
    title: 'Widespread API outage',
    impact: 'critical',
    status: 'resolved',
    startedAt: '2026-10-09T11:56:00Z',
  },
  {
    id: 'mock-7',
    title: 'Delayed usage data in the Console',
    impact: 'minor',
    status: 'resolved',
    startedAt: '2026-09-30T15:12:00Z',
    updates: [{ status: 'resolved', body: 'Usage data has caught up and is now current.' }],
  },
  {
    id: 'mock-8',
    title: 'Elevated failover rates to secondary providers',
    impact: 'major',
    status: 'resolved',
    startedAt: '2026-09-12T07:14:00Z',
    updates: [{ status: 'resolved', body: 'All impacted services have now fully recovered.' }],
  },
];
