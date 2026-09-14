import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function PricingLayout({
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
