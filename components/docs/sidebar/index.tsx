import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { source } from "@/lib/source";
import { NavMain } from "./nav-main";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

export function DocsSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4 pt-6">
        <Link href="/" aria-label="Cencori home" className="z-10 flex items-center">
          <Logo variant="wordmark" className="h-5 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent
        className={cn("docs-sidebar-top-fade select-none", "pt-2 pb-14")}
      >
        <NavMain tree={source.pageTree} />
      </SidebarContent>
    </Sidebar>
  );
}
