import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/docs/ui/sidebar";
import { RenderDefaultOptions } from "./render-default-options";
import { DocsSearch } from "./docs-search";
import { source } from "@/lib/source";
import { NavMain } from "./nav-main";
import { Logo } from "@/components/logo";
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
          className="z-10 flex items-center gap-2"
        >
          <Logo variant="wordmark" className="h-4 w-auto shrink-0" />
          <span className="font-inter text-xl font-medium normal-case tracking-tight">
            Docs
          </span>
        </Link>
      </SidebarHeader>
      <DocsSearch />
      <SidebarContent className="select-none pt-2 pb-14">
        <RenderDefaultOptions options={getStartedOptions} label="Get Started" />
        <NavMain tree={source.pageTree} />
      </SidebarContent>
    </Sidebar>
  );
}
