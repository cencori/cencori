import { redirect } from "next/navigation";

// Monetization was renamed to Revenue; keep old links working.
export default async function LegacyOrgMonetizationRedirect({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/~/revenue`);
}
