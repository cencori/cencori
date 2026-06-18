import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/docs/ui/sidebar";
import { RenderDefaultOptions } from "./render-default-options";
import { source } from "@/lib/source";
import { NavMain } from "./nav-main";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

export function DocsSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Root-level docs pages (no folder) become the "Get Started" group, since
  // NavMain only renders folders. Otherwise these pages have no sidebar entry.
  const getStartedOptions = source.pageTree.children
    .filter((node) => node.type === "page")
    .map((node) => {
      const page = node as { name: React.ReactNode; url: string };
      return {
        name: typeof page.name === "string" ? page.name : String(page.name),
        url: page.url,
        key: page.url.split("/").pop() ?? "",
      };
    });

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4 pt-6">
        <Link
          href="/"
          aria-label="Cencori home"
          className="z-10 flex items-center"
        >
          <Logo variant="wordmark" className="h-5 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent
        className={cn("docs-sidebar-top-fade select-none", "pt-2 pb-14")}
      >
        <RenderDefaultOptions options={getStartedOptions} label="Get Started" />
        <NavMain tree={source.pageTree} />
      </SidebarContent>
    </Sidebar>
  );
}
