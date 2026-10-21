import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  HOSTED_STATUS_PAGE_URL,
  getOutrayStatus,
  type OutrayIncident,
  type OutrayStatusPage,
} from '@/lib/outray-status';
import { statusBasePath, statusMainSiteHref } from '@/lib/status-host';
import { StatusShell } from '../status-shell';
import { MOCK_INCIDENTS } from './mock-incidents'; // TEMPORARY: remove with mock-incidents.ts

export const metadata: Metadata = {
  title: { absolute: 'Status history | Cencori' },
  description: 'Past incidents and maintenance for Cencori.',
  openGraph: {
    title: 'Cencori Status history',
    description: 'Past incidents and maintenance for Cencori.',
    images: ['/og/status'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cencori Status history',
    description: 'Past incidents and maintenance for Cencori.',
    images: ['/og/status'],
  },
};

export const revalidate = 30;

// All dates and times are UTC: OutRay's history is keyed by UTC calendar day,
// and a server render has no viewer time zone to convert into.
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

// Severity bar colour. Impact values are unconfirmed until OutRay publishes a
// real incident; anything unrecognised reads as a minor incident.
function impactColor(impact: string | undefined): string {
  switch (impact?.toLowerCase()) {
    case 'major':
    case 'critical':
    case 'outage':
      return 'bg-red-500';
    case 'maintenance':
      return 'bg-sky-500';
    default:
      return 'bg-amber-500';
  }
}

interface DatedIncident {
  incident: OutrayIncident;
  /** UTC calendar day, "YYYY-MM-DD". */
  day: string;
  at: Date | null;
}

// Incidents come from two places: the latest 25 at the page level, and each
// component's 90-day history. Merge and de-duplicate by id.
function collectIncidents(data: OutrayStatusPage): DatedIncident[] {
  const byId = new Map<string, DatedIncident>();
  const add = (incident: OutrayIncident, fallbackDay?: string) => {
    if (!incident?.id || byId.has(incident.id)) return;
    const stamp = incident.startedAt ?? incident.createdAt;
    const at = stamp ? new Date(stamp) : null;
    const day = at && !Number.isNaN(at.getTime()) ? at.toISOString().slice(0, 10) : fallbackDay;
    if (!day) return;
    byId.set(incident.id, { incident, day, at: at && !Number.isNaN(at.getTime()) ? at : null });
  };

  for (const incident of data.incidents) add(incident);
  const components = [...data.standaloneComponents, ...data.groups.flatMap((group) => group.components)];
  for (const component of components) {
    for (const day of component.history) {
      for (const incident of day.incidents) add(incident, day.date);
    }
  }

  return [...byId.values()].sort((a, b) =>
    b.day === a.day ? (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0) : b.day.localeCompare(a.day),
  );
}

/**
 * The days the history covers: from the first day with monitoring data (or an
 * incident) to the latest day in OutRay's 90-day window. Leading days with no
 * data at all are before monitoring began, so they aren't shown as history.
 */
function historyRange(
  data: OutrayStatusPage,
  incidents: DatedIncident[],
): { first: string; last: string } | null {
  const days = [...data.standaloneComponents, ...data.groups.flatMap((group) => group.components)]
    .flatMap((component) => component.history);
  const all = days.map((day) => day.date).sort();
  const observed = [
    ...days.filter((day) => day.checks > 0 || day.incidents.length > 0).map((day) => day.date),
    ...incidents.map((item) => item.day),
  ].sort();
  if (!all.length) return null;
  return { first: observed[0] ?? all[all.length - 1], last: all[all.length - 1] };
}

/** Month keys ("YYYY-MM"), newest first, covering the range. */
function monthsInRange(first: string, last: string): string[] {
  const months: string[] = [];
  let year = Number(last.slice(0, 4));
  let month = Number(last.slice(5, 7));
  const stop = first.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key <= stop) break;
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return months;
}

const utcDate = (key: string) => new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);

function latestUpdate(incident: OutrayIncident): string | null {
  const update = incident.updates?.[0];
  return update?.body ?? update?.message ?? null;
}

function IncidentRow({ item }: { item: DatedIncident }) {
  const { incident, at } = item;
  const summary = latestUpdate(incident);
  return (
    <li className="flex gap-4 py-3">
      <span aria-hidden="true" className={cn('w-[3px] shrink-0 rounded-full', impactColor(incident.impact))} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium">{incident.title ?? incident.name ?? 'Incident'}</p>
          {at ? <time dateTime={at.toISOString()} className="shrink-0 text-xs text-muted-foreground">{TIME.format(at)} UTC</time> : null}
        </div>
        {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
      </div>
    </li>
  );
}

function MonthSection({ month, incidents }: { month: string; incidents: DatedIncident[] }) {
  const days = [...new Set(incidents.map((item) => item.day))];
  return (
    <section aria-labelledby={`month-${month}`} className="border-t border-border pt-6">
      <h2 id={`month-${month}`} className="text-sm font-medium">{MONTH.format(utcDate(month))}</h2>
      {days.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No incidents reported.</p>
      ) : (
        <div className="mt-2">
          {days.map((day) => (
            <div key={day} className="flex gap-6 border-b border-border py-3 last:border-b-0">
              <p className="w-14 shrink-0 pt-3 text-sm">
                <span className="font-medium">{Number(day.slice(8, 10))}</span>{' '}
                <span className="text-xs text-muted-foreground">{WEEKDAY.format(utcDate(day))}</span>
              </p>
              <ul className="min-w-0 flex-1">
                {incidents
                  .filter((item) => item.day === day)
                  .map((item) => (
                    <IncidentRow key={item.incident.id} item={item} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function StatusHistoryPage() {
  const host = (await headers()).get('host') ?? '';
  const basePath = statusBasePath(host);
  const live = await getOutrayStatus();
  // TEMPORARY: design fixtures, development only. Remove with mock-incidents.ts.
  const data = live && process.env.NODE_ENV === 'development'
    ? { ...live, incidents: [...MOCK_INCIDENTS, ...live.incidents] }
    : live;
  const incidents = data ? collectIncidents(data) : [];
  const range = data ? historyRange(data, incidents) : null;

  return (
    <StatusShell subscriptionsEnabled={Boolean(data?.subscriptionsEnabled)} mainSiteHref={statusMainSiteHref(host)}>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href={basePath || '/'} className="hover:text-foreground">Cencori</Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">History</span>
      </nav>

      <div className="mb-6 mt-4 flex items-baseline gap-3">
        <h1 className="text-lg font-medium">History</h1>
        {range ? (
          <span className="text-sm text-muted-foreground">
            {range.first.slice(0, 7) === range.last.slice(0, 7)
              ? MONTH_SHORT.format(utcDate(range.last))
              : `${MONTH_SHORT.format(utcDate(range.first))} – ${MONTH_SHORT.format(utcDate(range.last))}`}
          </span>
        ) : null}
      </div>

      {data && range ? (
        <div className="space-y-8">
          {monthsInRange(range.first, range.last).map((month) => (
            <MonthSection key={month} month={month} incidents={incidents.filter((item) => item.day.startsWith(month))} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          History is temporarily unavailable here.{' '}
          <a href={HOSTED_STATUS_PAGE_URL} className="underline underline-offset-4">Open our backup status page</a>
        </p>
      )}
    </StatusShell>
  );
}
