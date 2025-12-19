// app/dashboard/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Logo } from "@/components/logo";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CircleUserRound, CreditCard, Settings, Users, UserPlus } from "lucide-react";
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

  // Use context instead of local state
  const { organizations, projects, loading: loadingOrgData } = useOrganizationProject();
  const { toggle } = useMobileSheet();
  const { setEnvironment, isTestMode } = useEnvironment();

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
          <span className="text-muted-foreground/50 ml-1 mr-1 select-none text-sm" aria-hidden>
            /
          </span>
          <Breadcrumb className="sm:flex md:flex">
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
                        className="flex h-7 cursor-pointer items-center gap-1 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary/50 rounded-md transition-colors"
                      >
                        <SelectValue placeholder="Organizations">
                          {currentOrg?.name || "Organizations"}
                        </SelectValue>
                        <SelectPrimitive.Icon asChild>
                          <ChevronsUpDown
                            size={12}
                            className="text-muted-foreground/60"
                          />
                        </SelectPrimitive.Icon>
                      </SelectPrimitive.Trigger>
                      <SelectContent className="w-full sm:w-80 p-1">
                        <div className="px-2 py-1">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="search"
                              placeholder="Search organizations..."
                              className="w-full rounded-lg bg-background pl-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="h-auto w-full rounded-md overflow-y-auto">
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.slug} className="cursor-pointer">
                              {org.name}
                            </SelectItem>
                          ))}
                        </div>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectItem value="all" className="cursor-pointer">
                            All Organizations
                          </SelectItem>
                        </SelectGroup>
                        <SelectSeparator />
                        <Link href="/dashboard/organizations/new" className="flex items-center gap-2 cursor-pointer px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50">
                          <PlusCircle className="h-4 w-4" />
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
                        <SelectContent className="w-full sm:w-80 p-1">
                          <div className="px-2 py-1">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="search"
                                placeholder="Search projects..."
                                className="w-full rounded-lg bg-background pl-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="h-auto w-full rounded-md overflow-y-auto">
                            {projects.filter(p => p.orgSlug === orgSlug).map((proj) => (
                              <SelectItem key={proj.id} value={proj.slug} className="cursor-pointer">
                                {proj.name}
                              </SelectItem>
                            ))}
                          </div>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectItem value="all" className="cursor-pointer">
                              All Projects
                            </SelectItem>
                          </SelectGroup>
                          <SelectSeparator />
                          <Link href={`/dashboard/organizations/${orgSlug}/projects/new`} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50">
                            <PlusCircle className="h-4 w-4" />
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
            <div className="hidden md:flex items-center bg-muted/50 rounded-full p-1 border border-border ml-2">
              <button
                onClick={() => setEnvironment("production")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!isTestMode
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Production
              </button>
              <button
                onClick={() => setEnvironment("test")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${isTestMode
                  ? "bg-orange-500/10 text-orange-600 border border-orange-500/20 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Development
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="w-7 h-7 cursor-pointer inline-flex items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/40 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Toggle theme"
            onClick={() => {
              if (typeof document !== "undefined") {
                const html = document.documentElement;
                const isDark = html.classList.contains("dark");
                if (isDark) {
                  html.classList.remove("dark");
                  window.localStorage.setItem("theme", "light");
                } else {
                  html.classList.add("dark");
                  window.localStorage.setItem("theme", "dark");
                }
              }
            }}
          >
            {/* Light (sun) icon */}
            <svg
              className="h-3 w-3 text-zinc-700 dark:hidden"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            {/* Dark (moon) icon */}
            <svg
              className="h-3 w-3 text-zinc-300 hidden dark:block"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          {/* Add other header buttons as needed */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-7 w-7 cursor-pointer">
                {typeof avatar === "string" && avatar.length > 0 ? (
                  <AvatarImage src={avatar} alt={typeof name === "string" ? name : "User avatar"} />
                ) : (
                  <AvatarFallback>
                    <CircleUserRound className="h-5 w-5 text-zinc-500 dark:text-zinc-200" />
                  </AvatarFallback>
                )}
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-66" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-s leading-none dark:text-white text-black font-semibold">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                <CircleUserRound className="mr-2 h-4 w-4" />
                <span className="text-xs">Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/billing")}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span className="text-xs">Billing</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span className="text-xs"> Account Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/")}>

                <span className="text-xs">Homepage</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard/team")}>
                <Users className="mr-2 h-4 w-4" />
                <span className="text-xs">Team</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/invite-user")}>
                <UserPlus className="mr-2 h-4 w-4" />
                <span className="text-xs">Invite User</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
              >
                <span className="text-xs">Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Navigation Bar - only visible on mobile screens */}
      <MobileNav onMenuClick={toggle} projectSlug={projectSlug} />

      <main className="p-4 md:p-8 pt-24 lg:pt-16">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
