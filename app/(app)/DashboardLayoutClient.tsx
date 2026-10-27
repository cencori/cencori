"use client";
import { browserAuth } from "@/lib/auth/browser-auth";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AirdropIcon from "@hugeicons/core-free-icons/AirdropIcon";
import { CopilotContext } from "@/lib/contexts/CopilotContext";
import { CreditCard } from "lucide-react";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";
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
import { MaintenanceBanner } from "@/components/dashboard/MaintenanceBanner";
import { CencoriAgentSidebar } from "@/components/dashboard/CencoriAgentSidebar";
import { CopilotSpotlight } from "@/components/dashboard/CopilotSpotlight";
import { AGENT_HEADER_ACTIONS_SLOT_ID, COPILOT_HEADER_ACTIONS_SLOT_ID, COPILOT_OPEN_COOKIE, COPILOT_OPEN_MENU_EVENT } from "@/lib/console/copilot";
import { EnvironmentProvider, useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { ReactQueryProvider } from "@/lib/providers/ReactQueryProvider";
import { SessionProvider } from "@/lib/contexts/SessionContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  clearDashboardUserCache,
  readDashboardUserCache,
  writeDashboardUserCache,
  type DashboardUser,
} from "@/lib/auth/dashboard-user-cache";
import { getConsoleRoute, getConsoleSurface } from "@/lib/console/routing";
import { sanitizeAuthRedirectTarget } from "@/lib/auth-redirect";
import { useBusinessPlan } from "@/components/dashboard/billing/BusinessPlan";

const CommandPalette = dynamic(
  () => import("@/components/dashboard/CommandPalette").then((mod) => mod.CommandPalette),
);

export default function DashboardLayoutClient({
  children,
  initialAgentOpen = false,
  initialConversationId = null,
}: {
  children: React.ReactNode;
  // From the copilot cookies, read on the server so a refresh renders the
  // panel already open (no pop-in, no layout jump).
  initialAgentOpen?: boolean;
  initialConversationId?: string | null;
}) {
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
      const { data: { session }, error } = await browserAuth.getSession();
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
        // Carry the page they were trying to open through the login round-trip
        // (minus any single-use OAuth residue — a dead ?code= would otherwise
        // be reused as the next `next` and fail again).
        const returnTo =
          sanitizeAuthRedirectTarget(`${window.location.pathname}${window.location.search}`) ??
          window.location.pathname;
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
        // Analytics identification rides after hydration, off the critical
        // path — the static import would otherwise join the initial bundle
        // for a call that only matters once a session exists.
        void import("posthog-js").then((mod) => {
          try {
            mod.default.identify(sessionUser.id, {
              email: sessionUser.email,
              name: sessionUser.user_metadata?.name ?? sessionUser.user_metadata?.full_name,
              created_at: sessionUser.created_at,
            });
          } catch { /* non-critical */ }
        }).catch(() => { /* non-critical */ });
      }
    }
    check();

    const { data: { subscription } } = browserAuth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
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
                  name={name}
                  initialAgentOpen={initialAgentOpen}
                  initialConversationId={initialConversationId}>
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
  initialAgentOpen: boolean;
  initialConversationId: string | null;
}

function LayoutContent({ user, avatar, name, children, initialAgentOpen, initialConversationId }: LayoutContentProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Use context instead of local state
  const {
    organizations,
    projects,
    activeOrganization,
    activeProject,
  } = useOrganizationProject();
  const { toggle, isOpen: mobileSheetOpen, setIsOpen: setMobileSheetOpen } = useMobileSheet();
  const { isTestMode } = useEnvironment();

  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette();
  const [agentOpen, setAgentOpen] = useState(initialAgentOpen);

  // Remember whether Copilot is open across refreshes.
  useEffect(() => {
    document.cookie = `${COPILOT_OPEN_COOKIE}=${agentOpen ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }, [agentOpen]);

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

  // Copilot opening the command palette for the user.
  useEffect(() => {
    const onOpenMenu = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "command_palette") setCommandPaletteOpen(true);
    };
    window.addEventListener(COPILOT_OPEN_MENU_EVENT, onOpenMenu);
    return () => window.removeEventListener(COPILOT_OPEN_MENU_EVENT, onOpenMenu);
  }, [setCommandPaletteOpen]);

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
  // The full-screen Copilot page replaces the docked panel while it's open.
  const isCopilotPage = /\/copilot\/?$/.test(pathname);
  // One agent's pages (/agents/<id>/…) are a full-height workspace with a docked test panel.
  const isAgentWorkspace = /\/agents\/(?!new(?:\/|$))[^/]+/.test(pathname);
  // The memory graph is a canvas: it fills the workspace edge to edge.
  const isMemoryGraph = /\/memory\/graph\/?$/.test(pathname);
  const isFixedWorkspace = isPlayground || isAgentWorkspace || isMemoryGraph || isCopilotPage;
  // Phones get a bottom tab bar instead of the top bar, except in full-screen
  // workspaces, which put their own actions in the top bar and a composer at
  // the bottom. The playground has no top-bar actions, so it keeps the pill,
  // under the profile bar instead of over its composer.
  const hasMobileTabBar = !isFixedWorkspace || isPlayground;
  const isOnboardingFlow = pathname.includes("/onboarding");
  // Project settings (every tab) swaps the header's credits + Copilot buttons
  // for a single way out to organization settings.
  const isProjectSettingsPage = isCanonicalConsoleRoute
    ? consoleRoute?.scope === "project" && (pathname === "/settings" || pathname.startsWith("/settings/"))
    : Boolean(routeProjectSlug) && pathname.startsWith(`/${routeOrgSlug}/${routeProjectSlug}/settings`);
  // Organization settings (General, Advanced, Teams, Billing, Usage, Audit Log) do the
  // same in reverse: one button back to the selected project's settings.
  const ORGANIZATION_SETTINGS_AREAS = ["settings", "teams", "billing", "usage", "audit-log"];
  const isOrganizationSettingsPage = isCanonicalConsoleRoute
    ? pathname === "/organization/settings"
      || (consoleRoute?.scope === "organization" && ORGANIZATION_SETTINGS_AREAS.slice(1).includes(pathname.split("/")[1] ?? ""))
    : Boolean(routeOrgSlug) && pathname.split("/")[2] === "~" && ORGANIZATION_SETTINGS_AREAS.includes(pathname.split("/")[3] ?? "");
  const hasDesktopSidebar = (Boolean(orgSlug) || isCanonicalConsoleRoute)
    && !pathname.includes("/projects/new")
    && !pathname.includes("/projects/import");

  const currentOrg = organizations.find((org) => org.slug === orgSlug) ?? (
    isCanonicalConsoleRoute ? activeOrganization ?? undefined : undefined
  );
  const currentProject = projects.find((proj) => proj.slug === projectSlug && proj.orgSlug === orgSlug) ?? (
    isCanonicalConsoleRoute ? activeProject ?? undefined : undefined
  );
  const currentOrgId = currentOrg?.id ?? null;
  const settingsProjectSlug = (
    activeProject && (activeProject.orgSlug === orgSlug || activeProject.organization_id === currentOrgId)
      ? activeProject
      : projects.find((proj) => proj.orgSlug === orgSlug)
  )?.slug ?? null;
  const projectSettingsHref = isCanonicalConsoleRoute
    ? (settingsProjectSlug ? "/settings" : null)
    : (orgSlug && settingsProjectSlug ? `/${orgSlug}/${settingsProjectSlug}/settings` : null);
  const isSettingsPage = isProjectSettingsPage || isOrganizationSettingsPage;
  // The provider's org payload already carries the balance, so the pill
  // paints from it with no mount-time request. The 30s interval below keeps
  // it fresh; initialData is only the first paint.
  const contextBalance = Number(currentOrg?.credits_balance);
  const hasContextBalance = Number.isFinite(contextBalance);

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
    initialData: hasContextBalance ? { credits_balance: contextBalance } : undefined,
    initialDataUpdatedAt: hasContextBalance ? Date.now() : undefined,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const parsedCreditsBalance = Number(orgCreditsData?.credits_balance ?? 0);
  const creditsBalance = Number.isFinite(parsedCreditsBalance) ? parsedCreditsBalance : 0;
  const isLowCredits = creditsBalance > 0 && creditsBalance < 5;
  // Matches the gateway: under a cent (or in debt) can't serve requests.
  const isOutOfCredits = creditsBalance < 0.01;
  // Business organizations pay per conversation, not credits: the pill shows those instead.
  const businessPlan = useBusinessPlan(currentOrgId);
  const businessInfo = businessPlan.data?.account_type === "business" ? businessPlan.data : null;
  const businessUsedUp = !!businessInfo && (!businessInfo.active || (!!businessInfo.plan && businessInfo.conversations_used >= businessInfo.plan.conversations));
  const creditsPillClassName = [
    "hidden lg:inline-flex h-6 items-center gap-1.5 rounded-[4px] border px-2 text-[11px] font-medium transition-colors",
    (businessInfo ? businessUsedUp : isOutOfCredits)
      ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15"
      : !businessInfo && isLowCredits
        ? "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/15"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
  ].join(" ");
  const creditsLabel = orgCreditsError
    ? "Credits --"
    : orgCreditsLoading
      ? "Credits..."
      : formatCurrency(creditsBalance, 'USD', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  const agentProps = {
    project: currentProject ? { id: currentProject.id, name: currentProject.name, slug: currentProject.slug } : null,
    organization: currentOrg ? { id: currentOrg.id, name: currentOrg.name, slug: currentOrg.slug } : null,
    environment: (isTestMode ? "test" : "production") as "test" | "production",
    userName: name,
  };
  const copilotFullPageHref = isCanonicalConsoleRoute
    ? "/copilot"
    : orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}/copilot` : null;
  const copilotContext = {
    open: agentOpen,
    setOpen: setAgentOpen,
    fullPageHref: copilotFullPageHref,
    agent: agentProps,
  };

  return (
    <div
      className={cn(
        // pt: room for the maintenance banner above the fixed header.
        "dashboard-theme bg-background transition-colors font-inter pt-[var(--maintenance-banner-height,0px)]",
        isFixedWorkspace ? "flex h-svh flex-col overflow-hidden" : "min-h-screen",
        // Make room for the docked copilot so the dashboard shifts, not hides.
        agentOpen && !isCopilotPage && "lg:pr-[520px]",
      )}
    >
      <MaintenanceBanner />
      {!isOnboardingFlow && (
      <header className={cn(
        "fixed top-[var(--maintenance-banner-height,0px)] left-0 right-0 z-50 h-12 border-b border-border/30 bg-background px-4 md:px-6 flex items-center justify-between font-mono",
        hasMobileTabBar && "max-lg:hidden",
        // Phones, full-screen workspaces: under the profile bar (45px), not above it.
        !hasMobileTabBar && "max-lg:top-[calc(var(--maintenance-banner-height,0px)+45px)] max-lg:justify-start max-lg:gap-2",
        agentOpen && !isCopilotPage && "lg:right-[520px]",
        hasDesktopSidebar && "lg:left-64",
      )}>
        <div className="flex items-center gap-2 max-lg:hidden">
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
        {/* Phones: these sit straight in the bar, the page's actions far left and
            the pill far right. */}
        <div className="flex items-center gap-2 max-lg:contents">
          {/* Filled by the full-screen Copilot page (new chat, exit full screen). */}
          {isCopilotPage && <div id={COPILOT_HEADER_ACTIONS_SLOT_ID} className="flex items-center gap-1 font-sans max-lg:mr-auto" />}
          {/* Filled by an agent's pages: Test, Save, Publish. */}
          {isAgentWorkspace && <div id={AGENT_HEADER_ACTIONS_SLOT_ID} className="flex items-center gap-2 font-sans max-lg:mr-auto" />}
          {orgSlug && isProjectSettingsPage && (
            <Link
              href={isCanonicalConsoleRoute ? "/organization/settings" : `/${orgSlug}/~/settings`}
              className="inline-flex h-7 items-center rounded-md bg-primary px-3 font-sans text-xs font-medium text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.98]"
            >
              Organization settings
            </Link>
          )}

          {isOrganizationSettingsPage && projectSettingsHref && (
            <Link
              href={projectSettingsHref}
              className="inline-flex h-7 items-center rounded-md bg-primary px-3 font-sans text-xs font-medium text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.98]"
            >
              Project settings
            </Link>
          )}

          {orgSlug && !isSettingsPage && (
            <Link
              href={isCanonicalConsoleRoute ? "/billing" : `/${orgSlug}/~/billing`}
              className={creditsPillClassName}
              aria-label={businessInfo ? "View your plan" : "View organization credit balance"}
              title={businessInfo ? "Conversations this month" : "Organization credits"}
            >
              <CreditCard className="h-3 w-3" />
              <span>{businessInfo
                ? businessInfo.plan && businessInfo.active
                  ? `${Math.min(businessInfo.conversations_used, businessInfo.plan.conversations)} / ${businessInfo.plan.conversations} chats`
                  : "Plan ended"
                : creditsLabel}</span>
            </Link>
          )}

          {/* Hidden while Copilot is open: the panel has its own close. */}
          {!agentOpen && !isSettingsPage && !isCopilotPage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setAgentOpen(true)}
                  className="hidden h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground transition-[background-color,border-color,transform] hover:border-border hover:bg-secondary/70 active:scale-[0.98] lg:flex"
                  aria-label="Open Copilot"
                >
                  <HugeiconsIcon icon={AirdropIcon} className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Copilot</TooltipContent>
            </Tooltip>
          )}

          {/* Phones: the same pill as everywhere else, compact, at the far right. */}
          <MobileTabBar
            position="header"
            onCopilot={!agentOpen && !isCopilotPage ? () => {
              setMobileSheetOpen(false);
              setAgentOpen(true);
            } : undefined}
            onSearch={() => {
              setMobileSheetOpen(false);
              setCommandPaletteOpen(true);
            }}
            onMenu={toggle}
            menuOpen={mobileSheetOpen}
          />
        </div>
      </header>
      )}

      {/* Mobile Navigation Bar - only visible on mobile screens */}
      {!isOnboardingFlow && (
        <MobileNav onMenuClick={toggle} projectSlug={projectSlug} user={user} avatar={displayAvatar} placement={!isFixedWorkspace ? "sticky" : hasMobileTabBar ? "inline" : "aboveHeader"} />
      )}
      {!isOnboardingFlow && hasMobileTabBar && (
        <MobileTabBar
          // Unlike the desktop header, settings pages keep Copilot here: the pill
          // has no settings shortcut competing for the space.
          onCopilot={!agentOpen ? () => {
            setMobileSheetOpen(false);
            setAgentOpen(true);
          } : undefined}
          onSearch={() => {
            setMobileSheetOpen(false);
            setCommandPaletteOpen(true);
          }}
          onMenu={toggle}
          menuOpen={mobileSheetOpen}
          position={isPlayground ? "top" : "bottom"}
        />
      )}

      <main
        className={cn(
          isPlayground || isMemoryGraph || isCopilotPage || isAgentWorkspace
            ? "flex min-h-0 flex-1 flex-col overflow-hidden pt-0 lg:pt-12 pb-0"
            : isOnboardingFlow
              ? "p-4 md:p-6"
              // Phones: a 20px side gutter, so content runs close to the screen edge.
              : "px-5 md:p-6 pt-6 pb-28 md:pb-28 lg:pt-14 lg:pb-6"
        )}
      >
        <CopilotContext.Provider value={copilotContext}>
          {children}
        </CopilotContext.Provider>
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        consoleMode={isCanonicalConsoleRoute}
      />
      <CopilotSpotlight />
      <CencoriAgentSidebar
        open={agentOpen && !isCopilotPage}
        initialConversationId={initialConversationId}
        onOpenChange={setAgentOpen}
        onFullScreen={copilotFullPageHref ? () => {
          setAgentOpen(false);
          router.push(copilotFullPageHref);
        } : undefined}
        {...agentProps}
      />
    </div>
  );
}
