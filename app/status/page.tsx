import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getOutrayStatus } from '@/lib/outray-status';
import { statusBasePath, statusMainSiteHref } from '@/lib/status-host';
import StatusPageClient from './status-page-client';

export const metadata: Metadata = {
  title: { absolute: 'Status | Cencori' },
  description: 'Live status, 90-day uptime, and incident history for Cencori.',
  openGraph: {
    title: 'Cencori Status',
    description: 'Live status, 90-day uptime, and incident history for Cencori.',
  },
};

// Rendered with data so the first paint is real; the client then polls.
export const revalidate = 30;

export default async function StatusPage() {
  const host = (await headers()).get('host') ?? '';
  const initial = await getOutrayStatus();
  return (
    <StatusPageClient
      initial={initial}
      basePath={statusBasePath(host)}
      mainSiteHref={statusMainSiteHref(host)}
    />
  );
}
