import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon';
import BadgeXIcon from '@hugeicons/core-free-icons/BadgeXIcon';
import CheckmarkBadge02Icon from '@hugeicons/core-free-icons/CheckmarkBadge02Icon';
import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';
import type { OutrayState } from '@/lib/outray-status';

// One icon per state, used across the status pages: banner, component rows,
// bar tooltips and incident timelines. "No data" has no icon of its own and
// stays a grey dot.
const STATE_ICONS: Record<Exclude<OutrayState, 'unknown'>, { icon: typeof CheckmarkBadge02Icon; color: string }> = {
  operational: { icon: CheckmarkBadge02Icon, color: 'text-emerald-400' },
  degraded: { icon: AlertCircleIcon, color: 'text-amber-400' },
  outage: { icon: BadgeXIcon, color: 'text-red-400' },
};

export function StateIcon({ state, className }: { state: OutrayState; className: string }) {
  if (state === 'unknown') {
    return <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-zinc-500" />;
  }
  const { icon, color } = STATE_ICONS[state];
  return <HugeiconsIcon icon={icon} aria-hidden="true" className={cn('shrink-0', color, className)} />;
}
