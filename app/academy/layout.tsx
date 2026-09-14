import { Metadata } from "next";
import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { buildOgImageUrl } from "@/lib/og";

const academyOgImage = buildOgImageUrl({
    title: "Cencori Academy",
    subtitle: "Interactive tutorials for AI production",
    type: "docs",
});

export const metadata: Metadata = {
    title: "Academy | Cencori",
    description: "Learn to build production AI applications with Cencori through interactive tutorials.",
    openGraph: {
        title: "Cencori Academy",
        description: "Interactive tutorials for building production AI applications",
        images: [academyOgImage],
    },
};

export default function AcademyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <SiteNav solid />
            {children}
            <SiteFooter />
        </div>
    );
}
