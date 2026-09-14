import { SiteFooter } from "@/components/marketing/SiteFooter";
import { MarketingNav } from "@/components/nav/MarketingNav";

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="marketing-theme flex min-h-screen flex-col bg-background text-foreground [--border:#b8b8b8] dark:[--border:#4a4a4a]">
            <MarketingNav />
            <main className="flex-1">{children}</main>
            <SiteFooter />
        </div>
    );
}
