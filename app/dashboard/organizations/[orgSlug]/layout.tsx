"use client"

import React, { useEffect, useState } from "react";
import { notFound, redirect, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarTrigger,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarInput,
  SidebarSeparator,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Home, Settings, Package, Users, Handshake, CreditCard } from "lucide-react";
import { SettingsIcon } from "@/components/animate-ui/icons/settings";
import { Layers, LayersIcon } from "@/components/animate-ui/icons/layers";
import { Unplug, UnplugIcon } from "@/components/animate-ui/icons/unplug";
import { ActivityIcon } from "@/components/animate-ui/icons/activity";
import { PanelTopIcon } from "@/components/animate-ui/icons/panel-top";
import { UserRoundIcon } from "@/components/animate-ui/icons/user-round";


interface OrganizationData {
  id: string;
  name: string;
  slug: string;
}

export default function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  const { orgSlug } = params;
  const router = useRouter();
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          redirect("/login");
          return;
        }

        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("id, name, slug")
          .eq("slug", orgSlug)
          .eq("owner_id", user.id)
          .single();

        if (orgError || !orgData) {
          console.error("Error fetching organization:", orgError?.message);
          notFound();
          return;
        }
        setOrganization(orgData);

      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [orgSlug]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-red-500">Organization not found.</p>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" className="top-12 h-[calc(100vh-3rem)]">
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Projects">
                  <Link href={`/dashboard/organizations/${orgSlug}/projects`}>
                    <LayersIcon animateOnHover/>
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Billing">
                  <Link href={`/dashboard/organizations/${orgSlug}/billing`}>
                    <PanelTopIcon animateOnHover/>
                    <span>Billing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Usage">
                  <Link href={`/dashboard/organizations/${orgSlug}/usage`}>
                    <ActivityIcon animateOnHover/>
                    <span>Usage</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Integrations">
                  <Link href={`/dashboard/organizations/${orgSlug}/integrations`}>
                    <UnplugIcon animateOnHover/>
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Teams">
                  <Link href={`/dashboard/organizations/${orgSlug}/teams`}>
                    <UserRoundIcon animateOnHover/>
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
