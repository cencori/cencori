import { redirect } from "next/navigation";

// Monetization was renamed to Revenue; keep old links working.
export default async function LegacyMonetizationRedirect({ params }: { params: Promise<{ orgSlug: string; projectSlug: string }> }) {
  const { orgSlug, projectSlug } = await params;
  redirect(`/${orgSlug}/${projectSlug}/revenue`);
}
