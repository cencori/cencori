"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Logo } from "@/components/logo";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LogOut, CircleUserRound, CreditCard, Settings, Home, Users, UserPlus } from "lucide-react";
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
  SelectLabel,
  SelectSeparator,
  SelectValue,
  SelectPrimitive,
} from "@/components/ui/select";
import { ChevronsUpDown, PlusCircle, Search, MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Package, Handshake } from "lucide-react";

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
  orgSlug?: string;
}

interface MobileLayoutProps {
  user: UserType;
  avatar: string | null;
  name: string | null;
  children: React.ReactNode;
}

export default function MobileLayout({ user, avatar, name, children }: MobileLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingOrgData, setLoadingOrgData] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );

  useEffect(() => {
    const fetchOrgAndProjects = async () => {
      setLoadingOrgData(true);
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        console.error("User not logged in:", userError?.message);
        setLoadingOrgData(false);
        return;
      }

      const { data: orgsData, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("owner_id", currentUser.id);

      if (orgsError) {
        console.error("Error fetching organizations:", orgsError.message);
      } else {
        setOrganizations(orgsData || []);
      }

      if (orgsData && orgsData.length > 0) {
        const orgIds = orgsData.map(org => org.id);
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, slug, organization_id")
          .in("organization_id", orgIds);

        if (projectsError) {
          console.error("Error fetching projects:", projectsError.message);
        } else {
          const projectsWithOrgSlug = projectsData?.map(proj => ({
            ...proj,
            orgSlug: orgsData.find(org => org.id === proj.organization_id)?.slug
          })) || [];
          setProjects(projectsWithOrgSlug);
        }
      }
      setLoadingOrgData(false);
    };

    fetchOrgAndProjects();
  }, [user]);

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
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen bg-white-50 dark:bg-black transition-colors">
        <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-zinc-100 dark:border-zinc-800 bg-background px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/organizations" className="flex items-center gap-3">
              <Logo variant="mark" className="h-4"/>
            </Link>
            <BreadcrumbSeparator className="hidden sm:block"> / </BreadcrumbSeparator>
            <Breadcrumb className="sm:flex">
              <BreadcrumbList>
                {orgSlug && (
                  <React.Fragment>
                    <BreadcrumbItem className="max-w-[120px] sm:max-w-none truncate">
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
                            className="flex h-8 cursor-pointer w-full items-center justify-between p-1.5 text-foreground"
                          >
                            <SelectValue placeholder="Organizations">
                              {currentOrg?.name || "Organizations"}
                            </SelectValue>
                            <SelectPrimitive.Icon asChild>
                              <ChevronsUpDown
                                size={14}
                                className="ml-2 text-muted-foreground/80"
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

                {orgSlug && projectSlug && !pathname.includes("new") && !pathname.includes("edit") && (
                  <React.Fragment>
                    <BreadcrumbSeparator className="hidden sm:block"> / </BreadcrumbSeparator>
                    <BreadcrumbItem className="max-w-[120px] sm:max-w-none truncate">
                      {projectSlug || !pathname.includes("new") || !pathname.includes("edit") ? (
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
                            className="flex h-8 w-full cursor-pointer items-center justify-between p-1.5 text-foreground focus-visible:bg-accent focus-visible:ring-0 [&>span]:line-clamp-none"
                          >
                            <SelectValue placeholder="Projects">
                              {currentProject?.name || "Projects"}
                            </SelectValue>
                            <SelectPrimitive.Icon asChild>
                              <ChevronsUpDown
                                size={14}
                                className="ml-2 text-muted-foreground/80"
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
                    <BreadcrumbSeparator className="hidden sm:block"> / </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbPage>New Organization</BreadcrumbPage>
                    </BreadcrumbItem>
                  </React.Fragment>
                )}

                {orgSlug && pathname.includes("/projects/new") && (
                  <React.Fragment>
                    <BreadcrumbSeparator className="hidden sm:block"> / </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbPage>New Project</BreadcrumbPage>
                    </BreadcrumbItem>
                  </React.Fragment>
                )}

                {orgSlug && projectSlug && pathname.includes("/edit") && (
                  <React.Fragment>
                    <BreadcrumbSeparator className="hidden sm:block"> / </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbPage>Edit Project</BreadcrumbPage>
                    </BreadcrumbItem>
                  </React.Fragment>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
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

            {/* User Dropdown Menu */}
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

        {/* Mobile Sidebar Trigger - visible only on mobile (below md breakpoint) */}
        <div className="fixed top-12 z-40 w-full bg-background md:hidden border-b border-zinc-100 dark:border-zinc-800 px-3 py-2">
          <SidebarTrigger>
            <MenuIcon className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </SidebarTrigger>
        </div>

        <Sidebar collapsible="offcanvas" side="bottom" className="md:hidden">
          <SidebarContent className="pb-8">
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                </SidebarMenuItem>
                <SidebarMenuItem>
                </SidebarMenuItem>
                {orgSlug && (
                  <React.Fragment>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Projects">
                        <Link href={`/dashboard/organizations/${orgSlug}/projects`}>
                          <Package />
                          <span>Projects</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Billing">
                        <Link href={`/dashboard/organizations/${orgSlug}/billing`}>
                          <CreditCard />
                          <span>Billing</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Usage">
                        <Link href={`/dashboard/organizations/${orgSlug}/usage`}>
                          <Handshake />
                          <span>Usage</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Integrations">
                        <Link href={`/dashboard/organizations/${orgSlug}/integrations`}>
                          <Users />
                          <span>Integrations</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Teams">
                        <Link href={`/dashboard/organizations/${orgSlug}/teams`}>
                          <Users />
                          <span>Teams</span>
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuButton asChild tooltip="Settings">
                        <Link href={`/dashboard/organizations/${orgSlug}/settings`}>
                          <Settings />
                          <span>Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </React.Fragment>
                )}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="p-4 md:p-8 pt-28 overflow-x-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
