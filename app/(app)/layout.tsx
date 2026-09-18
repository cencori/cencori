// app/dashboard/layout.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Logo } from "@/components/logo";
import { CreditCard, Menu, Search } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { OrganizationProjectProvider, useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { MobileSheetProvider, useMobileSheet } from "@/lib/contexts/MobileSheetContext";
import { CommandPaletteProvider, useCommandPalette } from "@/lib/contexts/CommandPaletteContext";
import { ThemeScope } from "@/components/theme-scope";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { CencoriAgentSidebar } from "@/components/dashboard/CencoriAgentSidebar";
import { EnvironmentProvider, useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { ReactQueryProvider } from "@/lib/providers/ReactQueryProvider";
import { SessionProvider } from "@/lib/contexts/SessionContext";
import { useQuery } from "@tanstack/react-query";
import posthog from "posthog-js";
import { cn } from "@/lib/utils";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  clearDashboardUserCache,
  readDashboardUserCache,
  writeDashboardUserCache,
  type DashboardUser,
} from "@/lib/auth/dashboard-user-cache";
import { getConsoleRoute, getConsoleSurface } from "@/lib/console/routing";

const CommandPalette = dynamic(
  () => import("@/components/dashboard/CommandPalette").then((mod) => mod.CommandPalette),
);
const UpdateToast = dynamic(
  () => import("@/components/ui/update-toast").then((mod) => mod.UpdateToast),
  { ssr: false },
);


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<{
    loading: boolean;
    user: DashboardUser | null;
  }>({ loading: true, user: null });

  useEffect(() => {
    let mounted = true;
    const cachedUser = readDashboardUserCache();
    if (cachedUser) {
      setAuthState({ loading: false, user: cachedUser });
    }

    async function check() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        // This request already passed middleware.ts (or the org layout's
        // server-side check), so the session is valid as far as the server is
        // concerned. A null session here means the client couldn't read the
        // cookie — historically that raced the redirect and bounced people
        // straight back to /login after a successful sign-in. Only give up when
        // there's also no cached user, i.e. nothing to render at all.
        if (cachedUser) return;

        clearDashboardUserCache();
        if (mounted) {
          setAuthState({ loading: true, user: null });
        }
        // Carry the page they were trying to open through the login round-trip.
        const returnTo = `${window.location.pathname}${window.location.search}`;
        router.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
        return;
      }

      const sessionUser = session.user;
      const dashboardUser: DashboardUser = {
        email: sessionUser.email,
        user_metadata: sessionUser.user_metadata,
      };
      writeDashboardUserCache(dashboardUser);

      if (mounted) {
        setAuthState({ loading: false, user: dashboardUser });
        // Identify user in PostHog
        try {
          posthog.identify(sessionUser.id, {
            email: sessionUser.email,
            name: sessionUser.user_metadata?.name ?? sessionUser.user_metadata?.full_name,
            created_at: sessionUser.created_at,
          });
        } catch { /* non-critical */ }
      }
    }
    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT") {
        // No redirect from here. A deliberate log-out navigates itself, and an
        // involuntary one (expired token, sign-out in another tab) belongs to
        // SessionProvider, which explains what happened and preserves the page
        // to come back to. Racing it with router.replace("/login") threw people
        // out mid-task with no context and no return path.
        clearDashboardUserCache();
        if (mounted) {
          setAuthState({ loading: true, user: null });
        }
      } else if (session?.user) {
        const dashboardUser: DashboardUser = {
          email: session.user.email,
          user_metadata: session.user.user_metadata,
        };
        writeDashboardUserCache(dashboardUser);
        if (mounted) {
          setAuthState({ loading: false, user: dashboardUser });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const typedUser = authState.user ?? {};
  const meta = typedUser.user_metadata ?? {};
  const avatar = (meta.avatar_url as string | null) ?? (meta.picture as string | null) ?? null;
  const name =
    (meta.name as string | null) ??
    typedUser.email?.split?.("@")[0] ??
    null;

  // SessionProvider sits outside the loading gate on purpose: when the session
  // drops out from under an open tab, `authState.loading` goes back to true and
  // the dashboard stops rendering — the interruption screen has to survive that
  // to be the thing the user actually sees.
  return (
    <ReactQueryProvider>
      <SessionProvider>
        {authState.loading ? null : (
          <CommandPaletteProvider>
          <MobileSheetProvider>
            <OrganizationProjectProvider>
              <EnvironmentProvider>
                <ThemeScope name="dashboard-theme" />
                <LayoutContent
                  user={typedUser}
                  avatar={avatar}
                  name={name}>
                  {children}
                </LayoutContent>
              </EnvironmentProvider>
            </OrganizationProjectProvider>
          </MobileSheetProvider>
          </CommandPaletteProvider>
        )}
      </SessionProvider>
    </ReactQueryProvider>
  );
}

type UserType = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

interface LayoutContentProps {
  user: UserType;
  avatar: string | null;
  name: string | null;
  children: React.ReactNode;
}

function LayoutContent({ user, avatar, name, children }: LayoutContentProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Use context instead of local state
  const {
    organizations,
    projects,
    activeOrganization,
    activeProject,
  } = useOrganizationProject();
  const { toggle } = useMobileSheet();
  const { isTestMode } = useEnvironment();

  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette();
  const [agentOpen, setAgentOpen] = useState(false);

  // Fetch user profile to get custom avatar
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const response = await fetch("/api/user/profile");
      if (!response.ok) return null;
      const data = await response.json();
      return data.profile;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use custom avatar from profile, fallback to OAuth avatar
  const displayAvatar = userProfile?.avatar_url || avatar;

  // ⌘K keyboard shortcut for command palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const routeOrgSlug = useMemo(() => {
    if (getConsoleSurface(pathname)) {
      return null;
    }
    if (pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return null;
    }
    if (pathname.startsWith("/account/") || pathname === "/account") {
      return null;
    }
    const match = pathname.match(/^\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const routeProjectSlug = useMemo(() => {
    const slug = routeOrgSlug;
    if (!slug) return null;
    const match = pathname.match(new RegExp(`^/${slug}/([^/]+)`));
    if (!match) return null;
    const second = match[1];
    const reserved = ['~'];
    if (reserved.includes(second)) return null;
    return second;
  }, [pathname, routeOrgSlug]);

  const consoleRoute = getConsoleRoute(pathname);
  const isCanonicalConsoleRoute = consoleRoute !== null;
  const orgSlug = routeOrgSlug ?? (isCanonicalConsoleRoute ? activeOrganization?.slug ?? null : null);
  const projectSlug = routeProjectSlug ?? (
    consoleRoute?.scope === "project" ? activeProject?.slug ?? null : null
  );
  const isPlayground = pathname.includes("/playground");
  const isOnboardingFlow = pathname.includes("/onboarding");
  const hasDesktopSidebar = Boolean(orgSlug) && !pathname.includes("/projects/new") && !pathname.includes("/projects/import");

  const currentOrg = organizations.find((org) => org.slug === orgSlug) ?? (
    isCanonicalConsoleRoute ? activeOrganization ?? undefined : undefined
  );
  const currentProject = projects.find((proj) => proj.slug === projectSlug && proj.orgSlug === orgSlug) ?? (
    isCanonicalConsoleRoute ? activeProject ?? undefined : undefined
  );
  const currentOrgId = currentOrg?.id ?? null;

  const {
    data: orgCreditsData,
    isLoading: orgCreditsLoading,
    isError: orgCreditsError,
  } = useQuery({
    queryKey: ["orgCreditsBalance", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      if (!currentOrgId) {
        return { credits_balance: 0 };
      }

      const { data, error } = await supabase
        .from("organizations")
        .select("credits_balance")
        .eq("id", currentOrgId)
        .single();

      if (error) {
        throw error;
      }

      return data as { credits_balance: number | string | null };
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const parsedCreditsBalance = Number(orgCreditsData?.credits_balance ?? 0);
  const creditsBalance = Number.isFinite(parsedCreditsBalance) ? parsedCreditsBalance : 0;
  const isLowCredits = creditsBalance > 0 && creditsBalance < 5;
  const isOutOfCredits = creditsBalance <= 0;
  const creditsPillClassName = [
    "hidden lg:inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
    isOutOfCredits
      ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15"
      : isLowCredits
        ? "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/15"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
  ].join(" ");
  const creditsLabel = orgCreditsError
    ? "Credits --"
    : orgCreditsLoading
      ? "Credits..."
      : formatCurrency(creditsBalance, 'USD', { maximumFractionDigits: 4, minimumFractionDigits: 2 });

  return (
    <div
      className={cn(
        "dashboard-theme bg-background transition-colors font-inter",
        isPlayground ? "flex h-svh flex-col overflow-hidden" : "min-h-screen"
      )}
    >
      {!isOnboardingFlow && (
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 h-12 border-b border-border/30 bg-background px-4 md:px-6 flex items-center justify-between font-mono",
        hasDesktopSidebar && "lg:left-64",
      )}>
        <div className="flex items-center gap-2">
          {/* Breadcrumbs - hidden on mobile */}
          <Breadcrumb className="hidden lg:flex">
            <BreadcrumbList>
              {pathname.includes("/organizations/new") && (
                <React.Fragment>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">New organization</BreadcrumbPage>
                  </BreadcrumbItem>
                </React.Fragment>
              )}

              {orgSlug && pathname.includes("/projects/new") && (
                <React.Fragment>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">New project</BreadcrumbPage>
                  </BreadcrumbItem>
                </React.Fragment>
              )}

              {orgSlug && projectSlug && pathname.includes("/edit") && (
                <React.Fragment>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">Edit project</BreadcrumbPage>
                  </BreadcrumbItem>
                </React.Fragment>
              )}
            </BreadcrumbList>
          </Breadcrumb>

        </div>
        <div className="flex items-center gap-2">
          {orgSlug && (
            <Link
              href={isCanonicalConsoleRoute ? "/billing" : `/${orgSlug}/~/billing`}
              className={creditsPillClassName}
              aria-label="View organization credit balance"
              title="Organization credits"
            >
              <CreditCard className="h-3 w-3" />
              <span>{creditsLabel}</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setAgentOpen(true)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background text-[11px] font-medium text-foreground transition-[background-color,border-color,transform] hover:border-border hover:bg-secondary/70 active:scale-[0.98] lg:h-6 lg:w-auto lg:px-2.5"
            aria-label="Ask Cencori agent"
          >
            <Logo variant="mark" className="h-3" />
            <span className="hidden lg:inline">Ask agent</span>
          </button>

          {/* Search Button — mobile only (desktop lives in the sidebar footer) */}
          <button
            type="button"
            className="w-8 h-8 flex lg:hidden items-center justify-center gap-2 text-[11px] text-muted-foreground rounded-full bg-secondary/60 hover:bg-secondary transition-colors cursor-pointer"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Hamburger Menu - visible on mobile only */}
          <button
            type="button"
            onClick={toggle}
            className="w-8 h-8 flex lg:hidden items-center justify-center rounded-md bg-secondary/60 hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4 text-muted-foreground" />
          </button>

        </div>
      </header>
      )}

      {/* Mobile Navigation Bar - only visible on mobile screens */}
      {!isOnboardingFlow && (
        <MobileNav onMenuClick={toggle} projectSlug={projectSlug} user={user} avatar={displayAvatar} />
      )}

      <main
        className={cn(
          isPlayground
            ? "flex min-h-0 flex-1 flex-col overflow-hidden pt-0 lg:pt-12 pb-0"
            : isOnboardingFlow
              ? "p-4 md:p-6"
              : "p-4 md:p-6 pt-20 lg:pt-14"
        )}
      >
        {children}
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        consoleMode={isCanonicalConsoleRoute}
      />
      <CencoriAgentSidebar
        open={agentOpen}
        onOpenChange={setAgentOpen}
        project={currentProject ? {
          id: currentProject.id,
          name: currentProject.name,
          slug: currentProject.slug,
        } : null}
        organization={currentOrg ? {
          id: currentOrg.id,
          name: currentOrg.name,
          slug: currentOrg.slug,
        } : null}
        environment={isTestMode ? "test" : "production"}
        userName={name}
      />
      <UpdateToast />
    </div>
  );
}
