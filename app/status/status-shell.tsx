import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GetUpdates } from './get-updates';

// Shared by "Get updates" and "View history" so they stay identical.
export const STATUS_BUTTON =
  'rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-white/90';

// Header and footer for every /status page. Standalone (no site nav/footer);
// keeps the marketing theme tokens. The footer sits at the bottom of the
// screen on short pages and after the content on long ones.
export function StatusShell({
  subscriptionsEnabled,
  mainSiteHref,
  children,
}: {
  subscriptionsEnabled: boolean;
  /** The logo's link: cencori.com's home (absolute on the status subdomain). */
  mainSiteHref: string;
  children: ReactNode;
}) {
  return (
    <div className="editorial-dark marketing-theme [--border:#b8b8b8] dark:[--border:#4a4a4a] min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-16 sm:px-6">
        <header className="mb-8 flex items-center justify-between gap-4">
          {/* Same lockup as the site nav's "CENCORI Developers". */}
          <Link href={mainSiteHref} aria-label="Cencori home" className="inline-flex items-center gap-3">
            <Image
              alt="Cencori"
              className="block h-auto w-[7.2rem] object-contain"
              height={63}
              priority
              src="/logos/w.png"
              width={524}
            />
            <span className="font-inter text-lg font-medium normal-case tracking-tight">Status</span>
          </Link>
          {subscriptionsEnabled ? <GetUpdates buttonClassName={STATUS_BUTTON} /> : null}
        </header>

        {children}

        <footer className="mt-auto pb-8 pt-16 text-center text-xs text-muted-foreground">
          <a
            href="https://outray.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5"
          >
            Powered by
            <Image src="/logos/outray.svg" alt="" width={14} height={14} className="size-3.5" />
            <span className="font-medium text-foreground">OutRay</span>
          </a>
        </footer>
      </div>
    </div>
  );
}
