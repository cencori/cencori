/**
 * Read-only client for OutRay's headless status API.
 *
 * OutRay runs the monitors; this feeds the Cencori-branded status page
 * (status.cencori.com, served from app/status). Anything added in OutRay — a monitor,
 * component, or group — appears here without a code change.
 *
 * Public, no key. Responses are cached upstream for 15s; poll at most once a
 * minute.
 */

export const OUTRAY_STATUS_URL =
  'https://status.outray.app/api/v1/pages/1ce0c653-9fea-40e6-a781-03dc8724afff';

/** POST { email } to subscribe to incident updates. CORS is open. */
export const OUTRAY_SUBSCRIBE_URL = `${OUTRAY_STATUS_URL}/subscribe`;

/**
 * OutRay's own hosted page: the fallback when the API can't be reached. Runs
 * on OutRay's infrastructure, so it stays up when ours doesn't.
 * (status.cencori.com is now this branded page, not OutRay's.)
 */
export const HOSTED_STATUS_PAGE_URL = 'https://cencori.status.outray.app';

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
  /** Severity of the day's incidents, e.g. "downtime". */
  incidentKind: string | null;
  incidents: OutrayIncidentRef[];
}

/** A day's short reference to an incident; the full record is in `incidents`. */
export interface OutrayIncidentRef {
  id: string;
  title: string;
  minutes: number;
  automatic: boolean;
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

// Confirmed against live incidents (2026-10-23). `updates` has only been seen
// empty, so its entries stay loosely typed.
export interface OutrayIncident {
  id: string;
  title: string;
  /** "open" | "resolved" */
  status: string;
  /** e.g. "down" while open, "recovered" once resolved. */
  stage: string;
  startedAt: string;
  resolvedAt: string | null;
  /** Component names. */
  components: string[];
  latestNote: string | null;
  latestNoteAt: string | null;
  updates: unknown[];
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
