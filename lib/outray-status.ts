/**
 * Read-only client for OutRay's headless status API.
 *
 * OutRay runs the monitors (status.cencori.com is its hosted page); this feeds
 * the Cencori-branded page at /status. Anything added in OutRay — a monitor,
 * component, or group — appears here without a code change.
 *
 * Public, no key. Responses are cached upstream for 15s; poll at most once a
 * minute.
 */

export const OUTRAY_STATUS_URL =
  'https://status.outray.app/api/v1/pages/1ce0c653-9fea-40e6-a781-03dc8724afff';

/** POST { email } to subscribe to incident updates. CORS is open. */
export const OUTRAY_SUBSCRIBE_URL = `${OUTRAY_STATUS_URL}/subscribe`;

/** OutRay's hosted page: the fallback when the API can't be reached. */
export const HOSTED_STATUS_PAGE_URL = 'https://status.cencori.com';

export type OutrayState = 'operational' | 'degraded' | 'outage' | 'unknown';

export interface OutrayHistoryDay {
  date: string;
  state: OutrayState;
  checks: number;
  successes: number;
  detectedFailureMinutes: number;
  reportedMonitors: number;
  expectedMonitors: number;
  incidentMinutes: number;
  incidentKind: string | null;
  incidents: OutrayIncident[];
}

export interface OutrayComponent {
  id: string;
  sortOrder: number;
  name: string;
  description: string | null;
  state: OutrayState;
  manual: boolean;
  updatedAt: string;
  observedUptime90d: number | null;
  history: OutrayHistoryDay[];
}

export interface OutrayGroup {
  id: string;
  sortOrder: number;
  name: string;
  state?: OutrayState;
  components: OutrayComponent[];
}

// The page has no incidents yet, so this shape isn't confirmed against a live
// response. Fields are optional on purpose; tighten once one is published.
export interface OutrayIncidentUpdate {
  status?: string;
  body?: string;
  message?: string;
  createdAt?: string;
}

export interface OutrayIncident {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  impact?: string;
  createdAt?: string;
  startedAt?: string;
  resolvedAt?: string | null;
  updatedAt?: string;
  updates?: OutrayIncidentUpdate[];
}

export interface OutrayStatusPage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  canonicalUrl: string;
  subscriptionsEnabled: boolean;
  state: OutrayState;
  generatedAt: string;
  groups: OutrayGroup[];
  standaloneComponents: OutrayComponent[];
  incidents: OutrayIncident[];
}

export async function getOutrayStatus(): Promise<OutrayStatusPage | null> {
  try {
    const response = await fetch(OUTRAY_STATUS_URL, { next: { revalidate: 30 } });
    if (!response.ok) return null;
    return (await response.json()) as OutrayStatusPage;
  } catch {
    return null;
  }
}
