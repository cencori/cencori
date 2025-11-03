"use client";

import React, { useEffect, useState } from "react";
import type { LayoutProps } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarRail,
  SidebarGroup,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { SettingsIcon } from "@/components/animate-ui/icons/settings";
import { LayersIcon } from "@/components/animate-ui/icons/layers";
import { UnplugIcon } from "@/components/animate-ui/icons/unplug";
import { ActivityIcon } from "@/components/animate-ui/icons/activity";
import { PanelTopIcon } from "@/components/animate-ui/icons/panel-top";
import { UserRoundIcon } from "@/components/animate-ui/icons/user-round";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
}

/**
 * Stable reference to the browser supabase client.
 * Hoisted to avoid react-hooks/exhaustive-deps complaints.
 */
const browserSupabase = supabase;

function CenteredPanel({ children }: { children: React.ReactNode }) {
  // We subtract 4rem (header ~3rem + trigger/gap ~1rem) from viewport height
  // so vertical centering occurs in the visible area beneath fixed header elements.
  return (
    <div className="flex items-center justify-center px-4">
      <div
        className="w-full max-w-5xl mx-auto text-center"
        style={{ minHeight: "calc(100vh - 4rem)" }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Layout for /dashboard/organizations/[orgSlug]
 *
 * Typed using Next's LayoutProps to match Next.js expectations and avoid
 * build-time TypeScript errors related to params typing.
 */
export default function OrganizationLayout({
  children,
  params,
}: LayoutProps<"/dashboard/organizations/[orgSlug]">) {
  // params is typed by LayoutProps; assert the shape for local usage
  const { orgSlug } = params as { orgSlug: string };

  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchOrganization = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await browserSupabase.auth.getUser();

        if (userError || !user) {
          // If user isn't authenticated, redirect to login
          redirect("/login");
          return;
        }

        const { data: orgData, error: orgError } = await browserSupabase
          .from("organizations")
          .select("id, name, slug")
          .eq("slug", orgSlug)
          .eq("owner_id", user.id)
          .single();

        if (orgError || !orgData) {
          console.error("Error fetching organization:", orgError?.message);
          // Let Next handle a 404
          notFound();
          return;
        }

        if (mounted) {
          setOrganization(orgData);
        }
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        if (mounted) {
          setError("An unexpected error occurred.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOrganization();

    return () => {
      mounted = false;
    };
  }, [orgSlug, browserSupabase]);

  // Loading
  if (loading) {
    return (
      <CenteredPanel>
        <p className="text-sm text-muted-foreground">Loading organization...</p>
      </CenteredPanel>
    );
  }

  // Error
  if (error) {
    return (
      <CenteredPanel>
        <p className="text-sm text-red-500">{error}</p>
      </CenteredPanel>
    );
  }

  // Not found (fallback guard)
  if (!organization) {
    return (
      <CenteredPanel>
        <p className="text-sm text-red-500">Organization not found.</p>
      </CenteredPanel>
    );
  }

  // Main layout when organization is present
  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" className="top-12 h-[calc(100vh-3rem)]">
        <SidebarContent>
          <SidebarGroup className="pt-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Projects">
                  <Link href={`/dashboard/organizations/${orgSlug}/projects`}>
                    <LayersIcon animateOnHover />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Billing">
                  <Link href={`/dashboard/organizations/${orgSlug}/billing`}>
                    <PanelTopIcon animateOnHover />
                    <span>Billing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Usage">
                  <Link href={`/dashboard/organizations/${orgSlug}/usage`}>
                    <ActivityIcon animateOnHover />
                    <span>Usage</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Integrations">
                  <Link href={`/dashboard/organizations/${orgSlug}/integrations`}>
                    <UnplugIcon animateOnHover />
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Teams">
                  <Link href={`/dashboard/organizations/${orgSlug}/teams`}>
                    <UserRoundIcon animateOnHover />
                    <span>Teams</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <Link href={`/dashboard/organizations/${orgSlug}/settings`}>
                    <SettingsIcon animateOnHover />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
        <SidebarFooter>
          <SidebarTrigger />
        </SidebarFooter>
      </Sidebar>

      <main className="flex w-full flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </SidebarProvider>
  );
}
