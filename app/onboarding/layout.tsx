import { headers } from "next/headers";
import { DisplayCurrencyProvider } from "@/hooks/useDisplayCurrency";
import { requestCountry } from "@/lib/geo/ip-country";

// The Pro checkout shows its naira price (₦20,000) to visitors in Nigeria and
// the dollar price ($20) everywhere else: the same rule as the dashboard and
// the pricing page.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
    const country = requestCountry(await headers());
    return <DisplayCurrencyProvider country={country}>{children}</DisplayCurrencyProvider>;
}
