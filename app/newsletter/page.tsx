import type { Metadata } from "next";
import Link from "next/link";

import { AuthNavbar } from "@/components/landing/AuthNavbar";
import { Footer } from "@/components/landing/Footer";
import { NewsletterSignupForm } from "@/components/newsletter/NewsletterSignupForm";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Subscribe to the Cencori newsletter for product updates, security research, and notes from the team.",
  alternates: {
    canonical: "/newsletter",
  },
  openGraph: {
    title: "Cencori Newsletter",
    description:
      "Product updates, security research, and notes from the team building the control plane for production AI.",
    url: "https://cencori.com/newsletter",
  },
  twitter: {
    title: "Cencori Newsletter",
    description:
      "Product updates, security research, and notes from the team building the control plane for production AI.",
  },
};

export const revalidate = 3600;

async function getConfirmedSubscriberCount() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }

  try {
    const { createAdminClient } = await import("@/lib/supabaseAdmin");
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed");

    if (error) {
      console.error("[NewsletterPage] Failed to load subscriber count:", error);
      return null;
    }

    return count ?? 0;
  } catch (error) {
    console.error("[NewsletterPage] Failed to initialize subscriber count:", error);
    return null;
  }
}

function getSubscriberLabel(count: number | null) {
  if (typeof count !== "number" || count < 25) {
    return "A few emails a month. Never filler.";
  }

  return `Join ${new Intl.NumberFormat("en-US").format(count)} subscribers`;
}

export default async function NewsletterPage() {
  const confirmedSubscriberCount = await getConfirmedSubscriberCount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthNavbar />

      <main className="pt-20">
        <section className="relative flex min-h-[72vh] items-center overflow-hidden bg-background py-24 md:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-foreground/5 via-background to-background pointer-events-none" />

          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/55 md:text-4xl lg:text-5xl">
                The Builder&apos;s Log.
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Product updates, security research, and notes from the team
                building the infrastructure for AI.
              </p>

              <p className="mt-4 text-xs font-medium text-muted-foreground">
                {getSubscriberLabel(confirmedSubscriberCount)}
              </p>

              <div className="mx-auto mt-10 max-w-2xl">
                <NewsletterSignupForm />
              </div>

              <p className="mx-auto mt-5 max-w-xl text-xs leading-6 text-muted-foreground">
                By subscribing, you agree to our{" "}
                <Link
                  href="/terms-of-service"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy-policy"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                . Unsubscribe in one click any time.
              </p>

              <div className="mt-8 flex flex-row items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md border-foreground/20 px-4 text-[11px] font-medium hover:bg-foreground/5 hover:border-foreground/40"
                  asChild
                >
                  <Link href={siteConfig.links.company.blog}>Read the blog</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-md px-4 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  asChild
                >
                  <Link href={siteConfig.links.docs}>Explore docs</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
