// app/dashboard/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Logo } from "@/components/logo";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CircleUserRound, CreditCard, Settings, Users, UserPlus, HelpCircle, MessageSquarePlus, Book, Wrench, Activity, Mail, Command, Menu } from "lucide-react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectValue,
  SelectPrimitive,
} from "@/components/ui/select";
import { ChevronsUpDown, PlusCircle, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { OrganizationProjectProvider, useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { MobileSheetProvider, useMobileSheet } from "@/lib/contexts/MobileSheetContext";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { EnvironmentProvider, useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { ReactQueryProvider } from "@/lib/providers/ReactQueryProvider";
import { useTheme } from "next-themes";


// Optional header/nav links later
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<unknown | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        // not signed in: redirect to login
        router.push("/login");
        return;
      }
      if (mounted) {
        setUser(data.user);
        setLoading(false);
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // while checking auth, render nothing or a simple skeleton to avoid flash
  if (loading) return null;

  // Fix type issue: ensure 'user' is typed
  type UserType = {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };

  const typedUser = (user ?? {}) as UserType;
  const meta = typedUser.user_metadata ?? {};
  const avatar = (meta.avatar_url as string | null) ?? (meta.picture as string | null) ?? null;
  const name =
    (meta.name as string | null) ??
    typedUser.email?.split?.("@")[0] ??
    null;

  return (
    <ReactQueryProvider>
      <MobileSheetProvider>
        <OrganizationProjectProvider>
          <EnvironmentProvider>
            <LayoutContent
              user={typedUser}
              avatar={avatar}
              name={name}>
              {children}
            </LayoutContent>
          </EnvironmentProvider>
        </OrganizationProjectProvider>
      </MobileSheetProvider>
    </ReactQueryProvider>
  );
}

type UserType = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  organization_id: string;
  orgSlug?: string; // Optional, as it's added later
}

interface LayoutContentProps {
  user: UserType;
  avatar: string | null;
  name: string | null;
  children: React.ReactNode;
}

function LayoutContent({ user, avatar, name, children }: LayoutContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // Use context instead of local state
  const { organizations, projects, loading: loadingOrgData } = useOrganizationProject();
  const { toggle } = useMobileSheet();
  const { setEnvironment, isTestMode } = useEnvironment();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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

  const getOrgSlug = () => {
    const match = pathname.match(/organizations\/([^/]+)/);
    return match ? match[1] : null;
  };

  const getProjectSlug = () => {
    const match = pathname.match(/projects\/([^/]+)/);
    return match ? match[1] : null;
  };

  const orgSlug = getOrgSlug();
  const projectSlug = getProjectSlug();

  const currentOrg = organizations.find((org) => org.slug === orgSlug);
  const currentProject = projects.find((proj) => proj.slug === projectSlug && proj.orgSlug === orgSlug);

  return (
    <div className="min-h-screen bg-background transition-colors">
      <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-border/40 bg-background px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/organizations" className="flex items-center">
            <Logo variant="mark" className="h-4" />
          </Link>
          {/* Breadcrumbs - hidden on mobile */}
          <span className="text-muted-foreground/50 ml-1 mr-1 select-none text-sm hidden lg:block" aria-hidden>
            /
          </span>
          <Breadcrumb className="hidden lg:flex">
            <BreadcrumbList>
              {orgSlug && (
                <React.Fragment>
                  <BreadcrumbItem>
                    <Select
                      value={currentOrg?.slug || "all"}
                      onValueChange={(slug) => {
                        if (slug === "all") {
                          router.push("/dashboard/organizations");
                        } else {
                          router.push(`/dashboard/organizations/${slug}/projects`);
                        }
                      }}
                    >
                      <SelectPrimitive.Trigger
                        className="flex h-7 cursor-pointer items-center gap-1.5 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary/50 rounded-md transition-colors"
                      >
                        <SelectValue placeholder="Organizations">
                          {currentOrg?.name || "Organizations"}
                        </SelectValue>
                        {currentOrg?.subscription_tier && (
                          <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded-full bg-primary/10 text-primary border border-primary/20">
                            {currentOrg.subscription_tier}
                          </span>
                        )}
                        <SelectPrimitive.Icon asChild>
                          <ChevronsUpDown
                            size={12}
                            className="text-muted-foreground/60"
                          />
                        </SelectPrimitive.Icon>
                      </SelectPrimitive.Trigger>
                      <SelectContent className="w-56 p-1">
                        <div className="px-1.5 py-1">
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                            <Input
                              type="search"
                              placeholder="Search organizations..."
                              className="h-6 w-full rounded bg-background pl-6 text-[11px] border-border/40"
                            />
                          </div>
                        </div>
                        <div className="h-auto w-full rounded-md overflow-y-auto max-h-40">
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.slug} className="cursor-pointer text-xs py-1.5">
                              {org.name}
                            </SelectItem>
                          ))}
                        </div>
                        <SelectSeparator className="my-1" />
                        <SelectGroup>
                          <SelectItem value="all" className="cursor-pointer text-xs py-1.5">
                            All Organizations
                          </SelectItem>
                        </SelectGroup>
                        <SelectSeparator className="my-1" />
                        <Link href="/dashboard/organizations/new" className="flex items-center gap-1.5 cursor-pointer px-2 py-1.5 text-xs outline-hidden select-none hover:bg-accent rounded-sm transition-colors">
                          <PlusCircle className="h-3 w-3" />
                          New Organization
                        </Link>
                      </SelectContent>
                    </Select>
                  </BreadcrumbItem>
                </React.Fragment>
              )}

              {orgSlug && projectSlug && (
                <React.Fragment>
                  <BreadcrumbSeparator className="text-muted-foreground/50 text-xs">/</BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {projectSlug ? (
                      <Select
                        value={currentProject?.slug || "all"}
                        onValueChange={(slug) => {
                          if (slug === "all") {
                            router.push(`/dashboard/organizations/${orgSlug}/projects`);
                          } else {
                            router.push(`/dashboard/organizations/${orgSlug}/projects/${slug}`);
                          }
                        }}
                      >
                        <SelectPrimitive.Trigger
                          className="flex h-7 cursor-pointer items-center gap-1 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary/50 rounded-md transition-colors"
                        >
                          <SelectValue placeholder="Projects">
                            {currentProject?.name || "Projects"}
                          </SelectValue>
                          <SelectPrimitive.Icon asChild>
                            <ChevronsUpDown
                              size={12}
                              className="text-muted-foreground/60"
                            />
                          </SelectPrimitive.Icon>
                        </SelectPrimitive.Trigger>
                        <SelectContent className="w-56 p-1">
                          <div className="px-1.5 py-1">
                            <div className="relative">
                              <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                              <Input
                                type="search"
                                placeholder="Search projects..."
                                className="h-6 w-full rounded bg-background pl-6 text-[11px] border-border/40"
                              />
                            </div>
                          </div>
                          <div className="h-auto w-full rounded-md overflow-y-auto max-h-40">
                            {projects.filter(p => p.orgSlug === orgSlug).map((proj) => (
                              <SelectItem key={proj.id} value={proj.slug} className="cursor-pointer text-xs py-1.5">
                                {proj.name}
                              </SelectItem>
                            ))}
                          </div>
                          <SelectSeparator className="my-1" />
                          <SelectGroup>
                            <SelectItem value="all" className="cursor-pointer text-xs py-1.5">
                              All Projects
                            </SelectItem>
                          </SelectGroup>
                          <SelectSeparator className="my-1" />
                          <Link href={`/dashboard/organizations/${orgSlug}/projects/new`} className="flex items-center gap-1.5 cursor-pointer px-2 py-1.5 text-xs outline-hidden select-none hover:bg-accent rounded-sm transition-colors">
                            <PlusCircle className="h-3 w-3" />
                            New Project
                          </Link>
                        </SelectContent>
                      </Select>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={`/dashboard/organizations/${orgSlug}/projects`}>
                          {currentProject?.name || projectSlug}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>

              )}

              {pathname.includes("/organizations/new") && (
                <React.Fragment>
                  <BreadcrumbSeparator className="text-muted-foreground/50 text-xs">/</BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">New organization</BreadcrumbPage>
                  </BreadcrumbItem>
                </React.Fragment>
              )}

              {orgSlug && pathname.includes("/projects/new") && (
                <React.Fragment>
                  <BreadcrumbSeparator className="text-muted-foreground/50 text-xs">/</BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">New project</BreadcrumbPage>
                  </BreadcrumbItem>
                </React.Fragment>
              )}

              {orgSlug && projectSlug && pathname.includes("/edit") && (
                <React.Fragment>
                  <BreadcrumbSeparator className="text-muted-foreground/50 text-xs">/</BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">Edit project</BreadcrumbPage>
                  </BreadcrumbItem>
                </React.Fragment>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          {projectSlug && (
            <div className="hidden md:flex items-center bg-muted/30 rounded-full p-0.5 border border-border/40 ml-2">
              <button
                onClick={() => setEnvironment("production")}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${!isTestMode
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Production
              </button>
              <button
                onClick={() => setEnvironment("test")}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${isTestMode
                  ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Development
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search Button (icon only on mobile) */}
          <button
            type="button"
            className="w-8 h-8 lg:w-auto lg:h-6 lg:px-2.5 flex items-center justify-center lg:justify-start gap-2 text-[11px] text-muted-foreground rounded-full bg-secondary/60 hover:bg-secondary transition-colors cursor-pointer"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Search className="h-4 w-4 lg:h-3 lg:w-3" />
            <span className="hidden lg:inline">Search...</span>
            <span className="hidden lg:flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
              <Command className="h-2.5 w-2.5" />K
            </span>
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

          {/* Feedback Button - hidden on mobile */}
          <DropdownMenu open={feedbackOpen} onOpenChange={setFeedbackOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hidden lg:block h-6 px-2.5 text-[11px] font-medium rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition-colors cursor-pointer"
              >
                Feedback
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-3">
              <div className="space-y-3">
                <textarea
                  placeholder="My idea for improving Cencori is..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full h-24 text-xs bg-secondary/50 border border-border/40 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring/20"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="h-7 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    disabled={!feedbackText.trim()}
                    onClick={() => {
                      // TODO: Submit feedback
                      setFeedbackText("");
                      setFeedbackOpen(false);
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help Button - hidden on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hidden lg:inline-flex w-6 h-6 items-center justify-center rounded-full border border-border/40 bg-transparent hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Help"
              >
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium">Need help with your project?</p>
                <p className="text-[11px] text-muted-foreground">Start with our docs or community.</p>
              </div>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem asChild className="text-xs py-1.5 cursor-pointer">
                <Link href="/docs" className="flex items-center gap-2">
                  <Book className="h-3.5 w-3.5" />
                  Docs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-xs py-1.5 cursor-pointer">
                <Link href="/docs/troubleshooting" className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5" />
                  Troubleshooting
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-xs py-1.5 cursor-pointer">
                <Link href="https://status.cencori.com" target="_blank" className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" />
                  Cencori status
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-xs py-1.5 cursor-pointer">
                <Link href="mailto:support@cencori.com" className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  Contact support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <div className="px-2 py-2">
                <p className="text-xs font-medium mb-1">Community support</p>
                <p className="text-[10px] text-muted-foreground mb-2">Our Discord community can help with code-related issues.</p>
                <Link
                  href="https://discord.gg/cencori"
                  target="_blank"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
                >
                  Join us on Discord
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Navigation Bar - only visible on mobile screens */}
      <MobileNav onMenuClick={toggle} projectSlug={projectSlug} user={user} avatar={avatar} />

      <main className="p-4 md:p-6 pt-20 lg:pt-14">
        {children}
      </main>
      <Toaster />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
      />
    </div>
  );
}
