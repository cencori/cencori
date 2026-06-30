import { ZettDocsProvider } from "@/components/zett/docs/sidebar-context";
import { ZettDocsSidebar } from "@/components/zett/docs/sidebar";
import { ZettDocsHeader } from "@/components/zett/docs/header";
import { zettSource } from "@/lib/zett-source";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Zett Docs", template: "%s — Zett" },
  description: "Zett — build production agents as files. Documentation.",
};

export default function ZettDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = zettSource.pageTree;

  return (
    <div className="zett-theme min-h-dvh bg-background text-foreground">
      <ZettDocsProvider>
        <ZettDocsHeader />
        <div className="mx-auto flex w-full max-w-6xl">
          <ZettDocsSidebar tree={tree} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </ZettDocsProvider>
    </div>
  );
}
