import { ThesisScrollNav } from "@/components/nav/MarketingNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="editorial-dark min-h-screen bg-background text-foreground">
            <ThesisScrollNav />
            <main className="flex-1 pt-20">{children}</main>
            <SiteFooter />
        </div>
    );
}
