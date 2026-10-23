import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  getOutrayIncident,
  getOutrayStatus,
  type OutrayIncident,
  type OutrayState,
  type OutrayIncidentUpdate,
} from '@/lib/outray-status';
import { statusBasePath, statusMainSiteHref } from '@/lib/status-host';
import { StateIcon } from '../../state-icon';
import { StatusShell } from '../../status-shell';
import { parseUpdateBody, UpdateBody } from './rich-text';

export const revalidate = 30;

type Params = Promise<{ id: string }>;

// UTC throughout, matching the history page.
const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

interface TimelineEntry {
  stage: string;
  /** Plain text: the fallback, and the only form for derived entries. */
  text: string;
  /** The editor's formatted document, when OutRay sent one. */
  body?: unknown;
  at: string | null;
}

function EntryText({ entry, className }: { entry: TimelineEntry; className: string }) {
  const doc = parseUpdateBody(entry.body);
  return (
    <div className={className}>
      {doc ? <UpdateBody doc={doc} /> : <p className="whitespace-pre-line text-sm leading-6">{entry.text}</p>}
    </div>
  );
}

// Icon and line colour per stage: broken (red), watching (amber), fixed (green).
function stageStyle(stage: string): { state: OutrayState; line: string } {
  switch (stage.toLowerCase()) {
    case 'monitoring':
      return { state: 'degraded', line: 'bg-amber-400/40' };
    case 'resolved':
    case 'recovered':
      return { state: 'operational', line: 'bg-emerald-400/40' };
    default:
      return { state: 'outage', line: 'bg-red-400/40' };
  }
}

function formatDateTime(value: string): string {
  return `${DATE_TIME.format(new Date(value))} UTC`;
}

function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// Plain text; the formatted `body` document is rendered separately.
function updateText(update: OutrayIncidentUpdate): string | null {
  return update.note ?? update.message ?? null;
}

/**
 * The full timeline, newest first: team updates merged with what OutRay's
 * monitoring recorded (detected, recovery confirmed), as OutRay's own incident
 * timeline shows them.
 */
function timeline(incident: OutrayIncident, automatic: boolean): TimelineEntry[] {
  const entries: TimelineEntry[] = incident.updates
    .map((update) => ({
      stage: update.stage ?? update.status ?? 'Update',
      text: updateText(update) ?? '',
      body: update.body,
      at: update.publishedAt ?? update.createdAt ?? null,
    }))
    .filter((entry) => entry.text);
  if (!entries.length && incident.latestNote) {
    entries.push({ stage: incident.status === 'resolved' ? 'Resolved' : 'Update', text: incident.latestNote, at: incident.latestNoteAt });
  }

  if (automatic) {
    entries.push({ stage: 'Detected', text: 'Downtime detected by monitoring.', at: incident.startedAt });
    if (incident.resolvedAt) {
      entries.push({ stage: 'Recovered', text: 'Monitoring confirmed the service recovered.', at: incident.resolvedAt });
    }
  } else if (!entries.length && incident.resolvedAt) {
    entries.push({ stage: 'Resolved', text: 'This incident has been resolved.', at: incident.resolvedAt });
  }

  return entries.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const incident = await getOutrayIncident(id);
  const title = incident ? `${incident.title} | Cencori Status` : 'Incident | Cencori Status';
  const description = incident
    ? `Incident report: ${incident.title}. Affected: ${incident.components.join(', ') || 'Cencori'}.`
    : 'Incident report for Cencori.';
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, images: ['/og/status'] },
    twitter: { card: 'summary_large_image', title, description, images: ['/og/status'] },
  };
}

function Card({ title, children, id }: { title: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border px-4 py-3 text-base font-medium">{title}</div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

// "Resolved · Full outage": how bad it was, from the history day's incidentKind.
function impactLabel(kind: string | null): string {
  switch (kind?.toLowerCase()) {
    case 'downtime':
    case 'outage':
    case 'down':
      return 'Full outage';
    case 'degraded':
      return 'Degraded performance';
    case 'maintenance':
      return 'Maintenance';
    default:
      return 'Partial outage';
  }
}

// Summary tint: near-black versions of the state colour, like the status banner.
const SUMMARY_TINTS = {
  resolved: { border: 'border-emerald-500/35', header: 'bg-[#06150f]' },
  ongoing: { border: 'border-red-500/35', header: 'bg-[#1a0707]' },
};

const TIME_ONLY = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** Incident window per component: healthy lead-in, the incident, then recovery. */
function ImpactBar({ ongoing, kind }: { ongoing: boolean; kind: string | null }) {
  const during = kind?.toLowerCase() === 'degraded' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div aria-hidden="true" className="mt-2 flex h-2.5 gap-px">
      <span className="w-[8%] rounded-[1px] bg-emerald-500" />
      <span className={cn('flex-1 rounded-[1px]', during)} />
      {ongoing ? null : <span className="w-[8%] rounded-[1px] bg-emerald-500" />}
    </div>
  );
}

export default async function IncidentPage({ params }: { params: Params }) {
  const { id } = await params;
  const host = (await headers()).get('host') ?? '';
  const basePath = statusBasePath(host);
  const [incident, page] = await Promise.all([getOutrayIncident(id), getOutrayStatus()]);
  if (!incident) notFound();

  // Whether OutRay opened it from a monitor (vs. a team-written incident).
  const days = [...(page?.standaloneComponents ?? []), ...(page?.groups.flatMap((group) => group.components) ?? [])]
    .flatMap((component) => component.history)
    .filter((day) => day.incidents.some((ref) => ref.id === id));
  const automatic = days.some((day) => day.incidents.some((ref) => ref.id === id && ref.automatic));
  const kind = days.find((day) => day.incidentKind)?.incidentKind ?? incident.stage;
  const ongoing = incident.status !== 'resolved';
  const tint = ongoing ? SUMMARY_TINTS.ongoing : SUMMARY_TINTS.resolved;
  const entries = timeline(incident, automatic);
  const latest = entries[0];
  const now = Date.now();

  return (
    <StatusShell subscriptionsEnabled={Boolean(page?.subscriptionsEnabled)} mainSiteHref={statusMainSiteHref(host)}>
      <div className="space-y-6">
        <section className={cn('overflow-hidden rounded-md border', tint.border)}>
          <div className={cn('px-4 py-3', tint.header)}>
            <Link
              href={`${basePath}/history`}
              aria-label={`${incident.title}. Back to history`}
              className="group -ml-1 flex items-center gap-2.5 rounded px-1"
            >
              <span aria-hidden="true" className="text-muted-foreground transition-colors group-hover:text-foreground">‹</span>
              <h1 className="text-base font-medium">{incident.title}</h1>
            </Link>
          </div>
          <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
            {ongoing ? 'Ongoing' : 'Resolved'}
            <span className="px-1.5">·</span>
            {impactLabel(kind)}
          </p>
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {latest.at ? (
                <>
                  {formatDateTime(latest.at)} ({formatSpan(now - new Date(latest.at).getTime())} ago)
                  <span className="px-1.5">·</span>
                </>
              ) : null}
              <a href="#updates" className="hover:text-foreground">View all updates</a>
            </p>
          </div>
        </section>

        <Card title="Affected components">
          {incident.components.length ? (
            <>
              <div className="flex justify-between border-b border-border pb-2 text-xs text-muted-foreground">
                <span>{formatDateTime(incident.startedAt)}</span>
                <span>{incident.resolvedAt ? `${TIME_ONLY.format(new Date(incident.resolvedAt))} UTC` : 'Ongoing'}</span>
              </div>
              <ul className="mt-3 space-y-4">
                {incident.components.map((name) => (
                  <li key={name}>
                    <p className="text-sm">{name}</p>
                    <ImpactBar ongoing={ongoing} kind={kind} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No components marked as affected</p>
          )}
        </Card>

        <Card title="Updates" id="updates">
          <ol>
            {entries.map((entry, index) => {
              const style = stageStyle(entry.stage);
              const newer = entries[index - 1];
              const last = index === entries.length - 1;
              return (
                <li key={`${entry.stage}-${entry.at}-${index}`} className="relative flex gap-3 pb-8 last:pb-0">
                  <div className="relative flex w-4 shrink-0 justify-center">
                    <StateIcon state={style.state} className="mt-0.5 size-4" />
                    {last ? null : (
                      // From this icon's bottom edge (2px offset + 16px icon) to the next
                      // icon's top (32px entry padding + its 2px offset).
                      <span aria-hidden="true" className={cn('absolute bottom-[-2.125rem] top-[1.125rem] w-px', style.line)} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{entry.stage}</p>
                    <EntryText entry={entry} className="mt-2" />
                    {entry.at ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(entry.at)}
                        {newer?.at ? (
                          <span className="text-muted-foreground/70">
                            {' '}({formatSpan(new Date(newer.at).getTime() - new Date(entry.at).getTime())} earlier)
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </StatusShell>
  );
}
