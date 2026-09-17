/**
 * Canonical newsroom taxonomy — shared by server (`lib/blog.ts`) and
 * client (`components/blog/blog-client.ts`) code.
 *
 * Keep this file free of `server-only`, `fs`, and other server imports
 * so client components can import it safely.
 *
 * Category rule of thumb:
 * - Engineering is inside-out — how *we* built Cencori, for peer engineers.
 *   The reader needs curiosity, not an API key.
 * - Developers is outside-in — how *you* build on Cencori (SDKs,
 *   integrations, guides). The reader finishes with something running.
 * - If the reader needs a Cencori API key to follow along, it's Developers.
 */

export type BlogCategory =
  | 'company'
  | 'research'
  | 'product'
  | 'engineering'
  | 'security'
  | 'developers'
  | 'community'
  | 'customers'
  | 'changelog'
  | 'press';

export interface BlogCategoryMeta {
  slug: BlogCategory | 'all';
  label: string;
  blurb: string;
}

export const BLOG_CATEGORIES: BlogCategoryMeta[] = [
  { slug: 'all', label: 'All', blurb: 'Everything, newest first.' },
  { slug: 'company', label: 'Company', blurb: 'Milestones, announcements, and Cencori’s voice on the industry.' },
  { slug: 'research', label: 'Research', blurb: 'Systems research, performance studies, and scientific writing.' },
  { slug: 'product', label: 'Product', blurb: 'Launches and new capabilities on the platform.' },
  { slug: 'engineering', label: 'Engineering', blurb: 'How we build Cencori — inside-out deep dives for peer engineers.' },
  { slug: 'security', label: 'Security', blurb: 'Security releases, safety engineering, and compliance.' },
  { slug: 'developers', label: 'Developers', blurb: 'SDKs, integrations, and guides — everything you need to ship on Cencori.' },
  { slug: 'customers', label: 'Customers', blurb: 'Teams running production AI on Cencori.' },
  { slug: 'community', label: 'Community', blurb: 'Stories and highlights from the Cencori ecosystem.' },
  { slug: 'changelog', label: 'Changelog', blurb: 'Every release, as it ships.' },
  { slug: 'press', label: 'Press', blurb: 'Cencori in the news — coverage and features.' },
];

export function getBlogCategoryMeta(slug: string): BlogCategoryMeta | null {
  return BLOG_CATEGORIES.find((c) => c.slug === slug) ?? null;
}
