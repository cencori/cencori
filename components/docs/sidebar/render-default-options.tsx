"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/docs/ui/sidebar";
import { getNavItemIcon } from "./nav-icons";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface SidebarOption {
  name: string;
  url: string;
  key: string;
}

export function RenderDefaultOptions({
  options,
  label,
}: {
  options: SidebarOption[];
  label: string;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  if (options.length === 0) return null;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {options.map((item) => {
          const isActive = pathname === item.url;
          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                className={cn(
                  !isActive &&
                    "text-muted-foreground/90 dark:text-muted-foreground/80 hover:text-primary dark:hover:text-primary",
                )}
                isActive={isActive}
              >
                <Link href={item.url} onClick={handleLinkClick}>
                  {getNavItemIcon(item.key)}
                  <span className="capitalize">{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
