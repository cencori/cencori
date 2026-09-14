import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function SolutionsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <SiteNav solid />
            <main className="flex-1">{children}</main>
            <SiteFooter />
        </div>
    );
}
