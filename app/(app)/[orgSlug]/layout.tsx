import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabaseServer";
import { getOrganizationMeta } from "@/lib/server/organization";
import { isConsoleHostname } from "@/lib/console/routing";
import OrganizationLayoutClient from "./OrganizationLayoutClient";

type LayoutParams = Promise<{ orgSlug: string }>;

export async function generateMetadata({
  params,
}: {
  params: LayoutParams;
}): Promise<Metadata> {
  const { orgSlug } = await params;

  try {
    const org = await getOrganizationMeta(orgSlug);

    if (org?.name) {
      return {
        title: org.name,
      };
    }
  } catch (error) {
    console.error("Error fetching organization for metadata:", error);
  }

  return {
    title: "Organization",
  };
}

// Org routes can't be protected by a middleware prefix — an org slug is any
// top-level segment — so the session check lives here, where the segment is
// unambiguous. It runs inside its own Suspense boundary so it never holds up
// the shell: the sidebar and page render immediately while the check
// resolves in parallel, and a missing session streams a redirect to /login.
// Every page loads its data client-side behind RLS / authenticated APIs, so
// nothing private renders before the redirect lands. (The proxy has already
// run the same check for canonical console pages.)
async function RequireSession({ orgSlug }: { orgSlug: string }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/${orgSlug}`)}`);
  }

  return null;
}

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutParams;
}) {
  const { orgSlug } = await params;
  const host = (await headers()).get("host") ?? "";

  return (
    <OrganizationLayoutClient consoleMode={isConsoleHostname(host)}>
      <Suspense fallback={null}>
        <RequireSession orgSlug={orgSlug} />
      </Suspense>
      {children}
    </OrganizationLayoutClient>
  );
}
