"use client";

// Structure and data only — visual design to be directed. Every piece of the
// page is a named component below so it can be restyled in place.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { StateIcon } from './state-icon';
import { STATUS_BUTTON, StatusShell } from './status-shell';
import {
  HOSTED_STATUS_PAGE_URL,
  OUTRAY_STATUS_URL,
  type OutrayComponent,
  type OutrayHistoryDay,
  type OutrayState,
  type OutrayStatusPage,
} from '@/lib/outray-status';

const POLL_MS = 60_000;

const OVERALL_LABELS: Record<OutrayState, string> = {
  operational: 'All systems operational',
  degraded: 'Partial disruption',
  outage: 'Major outage',
  unknown: 'Status unavailable',
};

const STATE_LABELS: Record<OutrayState, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Outage',
  unknown: 'No data',
};

const STATE_COLORS: Record<OutrayState, string> = {
  operational: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  outage: 'bg-red-500',
  unknown: 'bg-muted-foreground/30',
};

// Near-black tints of each state colour; the icon/dot carries the hue.
const BANNER_COLORS: Record<OutrayState, string> = {
  operational: 'bg-[#06150f]',
  degraded: 'bg-[#171005]',
  outage: 'bg-[#1a0707]',
  unknown: 'bg-zinc-900',
};

function useOutrayStatus(initial: OutrayStatusPage | null) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(OUTRAY_STATUS_URL, { cache: 'no-store' });
        if (!response.ok) return;
        const next = (await response.json()) as OutrayStatusPage;
        if (!cancelled) setData(next);
      } catch {
        // Keep showing the last good data; with none, the page links out.
      }
    };
    const interval = window.setInterval(load, POLL_MS);
    if (initial === null) void load();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [initial]);

  return data;
}

function formatUptime(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'No data';
  return `${value.toFixed(value === 100 ? 0 : 3)}% uptime`;
}

// History dates are calendar days ("2026-10-20"). Format in UTC, or local
// time zones west of UTC shift every bar back a day.
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}


function OverallBanner({ data }: { data: OutrayStatusPage }) {
  return (
    <section aria-live="polite" className={cn('rounded-md px-5 py-3.5 text-white', BANNER_COLORS[data.state])}>
      <div className="flex items-center gap-2.5">
        <StateIcon state={data.state} className="size-5" />
        <h1 className="text-lg font-medium">{OVERALL_LABELS[data.state]}</h1>
      </div>
      {data.description ? <p className="mt-3 text-sm text-white/80">{data.description}</p> : null}
    </section>
  );
}

function dayDetails(day: OutrayHistoryDay): string[] {
  const details: string[] = [];
  if (day.detectedFailureMinutes > 0) details.push(`${day.detectedFailureMinutes} min detected failure`);
  return details;
}

function dayLabel(day: OutrayHistoryDay): string {
  return [`${formatDate(day.date)}: ${STATE_LABELS[day.state]}`, ...dayDetails(day)].join(' · ');
}

function DayTooltip({ day, index, total }: { day: OutrayHistoryDay; index: number; total: number }) {
  // Pin to the edge near either end so the tooltip never overflows the row.
  const position = index < 8
    ? { left: 0 }
    : index > total - 9
      ? { right: 0 }
      : { left: `${((index + 0.5) / total) * 100}%`, transform: 'translateX(-50%)' };

  return (
    <div
      role="tooltip"
      style={position}
      className="pointer-events-none absolute top-full z-10 mt-2 w-max max-w-[16rem] rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg"
    >
      <p className="font-medium">{formatDate(day.date)}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-white/80">
        <StateIcon state={day.state} className="size-3.5" />
        {STATE_LABELS[day.state]}
      </p>
      {dayDetails(day).map((detail) => (
        <p key={detail} className="mt-0.5 text-white/60">{detail}</p>
      ))}
    </div>
  );
}

function UptimeBars({ component }: { component: OutrayComponent }) {
  const [active, setActive] = useState<number | null>(null);
  const total = component.history.length;

  return (
    <div className="relative mt-3">
      <ol aria-label={`${component.name}: 90-day history`} className="flex h-8 gap-px" onMouseLeave={() => setActive(null)}>
        {component.history.map((day, index) => (
          <li
            key={day.date}
            tabIndex={0}
            aria-label={dayLabel(day)}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            className={cn(
              'flex-1 rounded-[1px] outline-none transition-opacity focus-visible:ring-1 focus-visible:ring-white/60',
              STATE_COLORS[day.state],
              active !== null && active !== index && 'opacity-60',
            )}
          />
        ))}
      </ol>
      {active !== null && component.history[active] ? (
        <DayTooltip day={component.history[active]} index={active} total={total} />
      ) : null}
    </div>
  );
}

function ComponentRow({ component }: { component: OutrayComponent }) {
  return (
    <li className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <StateIcon state={component.state} className="size-4" />
          <span className="truncate text-sm font-medium">{component.name}</span>
          <span className="sr-only">{STATE_LABELS[component.state]}</span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatUptime(component.observedUptime90d)}</span>
      </div>
      {component.description ? <p className="mt-1 text-xs text-muted-foreground">{component.description}</p> : null}
      <UptimeBars component={component} />
    </li>
  );
}

function ComponentList({ components }: { components: OutrayComponent[] }) {
  return (
    <ul>
      {[...components]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((component) => (
          <ComponentRow key={component.id} component={component} />
        ))}
    </ul>
  );
}

function Components({ data }: { data: OutrayStatusPage }) {
  const groups = [...data.groups].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section aria-labelledby="components-heading" className="mt-12">
      <h2 id="components-heading" className="mb-4 text-lg font-medium">System status</h2>
      {data.standaloneComponents.length > 0 ? <ComponentList components={data.standaloneComponents} /> : null}
      {groups.map((group) => (
        <div key={group.id} className="mt-6">
          <h3 className="mb-3 text-sm font-medium">{group.name}</h3>
          <ComponentList components={group.components} />
        </div>
      ))}
      <p className="mt-3 text-xs text-muted-foreground">
        History covers the last 90 days. Grey days have no complete monitoring data.
      </p>
    </section>
  );
}

function ViewHistoryButton({ basePath }: { basePath: string }) {
  return (
    <div className="mt-10 flex justify-center">
      <Link
        href={`${basePath}/history`}
        className={STATUS_BUTTON}
      >
        View history
      </Link>
    </div>
  );
}

function Unavailable() {
  return (
    <section className="rounded-xl border border-border p-6">
      <h1 className="text-2xl font-medium">Status is temporarily unavailable here</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Live status is still published on our independent status page.
      </p>
      <a href={HOSTED_STATUS_PAGE_URL} className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
        Open our backup status page
      </a>
    </section>
  );
}

export default function StatusPageClient({
  initial,
  basePath,
  mainSiteHref,
}: {
  initial: OutrayStatusPage | null;
  /** "" on status.cencori.com, "/status" on other hosts. */
  basePath: string;
  mainSiteHref: string;
}) {
  const data = useOutrayStatus(initial);

  return (
    <StatusShell subscriptionsEnabled={Boolean(data?.subscriptionsEnabled)} mainSiteHref={mainSiteHref}>
      {data ? (
        <>
          <OverallBanner data={data} />
          <Components data={data} />
          <ViewHistoryButton basePath={basePath} />
        </>
      ) : (
        <Unavailable />
      )}
    </StatusShell>
  );
}
