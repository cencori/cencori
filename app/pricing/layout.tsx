import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThesisScrollNav } from "@/components/nav/MarketingNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { DisplayCurrencyProvider } from "@/hooks/useDisplayCurrency";
import { requestCountry } from "@/lib/geo/ip-country";

export const metadata: Metadata = {
    title: { absolute: "Cencori Pricing" },
};

export default async function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Naira by default for visitors in Nigeria, dollars elsewhere, until they
    // pick with the USD/NGN switch (same rule as the dashboard).
    const country = requestCountry(await headers());

    return (
        <div className="editorial-dark min-h-screen bg-background text-foreground">
            <ThesisScrollNav />
            <main className="flex-1 pt-20">
                <DisplayCurrencyProvider country={country}>{children}</DisplayCurrencyProvider>
            </main>
            <SiteFooter />
        </div>
    );
}
