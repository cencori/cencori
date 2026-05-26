import { Metadata } from "next";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DocsNavbarWrapper } from "@/components/docs/DocsNavbarWrapper";
import { Footer } from "@/components/landing/Footer";
import { DocsProvider } from "@/components/docs/DocsContext";
import { DocsContentWrapper } from "@/components/docs/DocsContentWrapper";
import { DocsSidebarWrapper } from "@/components/docs/DocsSidebarWrapper";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { buildOgImageUrl } from "@/lib/og";

const docsOgImage = buildOgImageUrl({
    title: "Documentation",
    subtitle: "Guides, API reference, and tutorials",
    type: "docs",
});

export const metadata: Metadata = {
    title: "Documentation",
    description: "Cencori documentation - guides, API reference, and tutorials.",
    openGraph: {
        title: "Documentation | Cencori",
        description: "Cencori documentation - guides, API reference, and tutorials.",
        images: [docsOgImage],
    },
    twitter: {
        card: "summary_large_image",
        title: "Documentation | Cencori",
        description: "Cencori documentation - guides, API reference, and tutorials.",
        images: [docsOgImage],
    },
};

const corner = "absolute flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <DocsProvider>
            <div
                className={`flex min-h-screen flex-col ${GeistSans.variable} ${GeistMono.variable}`}
                style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
            >
                <DocsNavbarWrapper />

                <DocsContentWrapper>
                    <div className="mx-auto w-full max-w-6xl border-x border-border/30 relative flex-1">
                        <div className={cn(corner, "-top-1.5 -left-1.5")}>+</div>
                        <div className={cn(corner, "-top-1.5 -right-1.5")}>+</div>

                        <DocsLayout>{children}</DocsLayout>

                        <div className={cn(corner, "-bottom-1.5 -left-1.5")}>+</div>
                        <div className={cn(corner, "-bottom-1.5 -right-1.5")}>+</div>
                    </div>

                    <Footer />
                </DocsContentWrapper>

                <DocsSidebarWrapper />
            </div>
        </DocsProvider>
    );
}

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}
