import { Metadata } from "next";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DocsNavbar } from "@/components/docs/DocsNavbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Documentation",
    description: "Cencori documentation - guides, API reference, and tutorials.",
    openGraph: {
        title: "Documentation | Cencori",
        description: "Cencori documentation - guides, API reference, and tutorials.",
        images: ["/api/og?title=Documentation&subtitle=Guides, API reference, and tutorials&type=docs"],
    },
    twitter: {
        card: "summary_large_image",
        title: "Documentation | Cencori",
        description: "Cencori documentation - guides, API reference, and tutorials.",
        images: ["/api/og?title=Documentation&subtitle=Guides, API reference, and tutorials&type=docs"],
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <DocsNavbar />
            <DocsLayout>{children}</DocsLayout>
        </div>
    );
}
