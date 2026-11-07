"use client";

import { cn } from "@/lib/utils";
import { useDisplayCurrency, type DisplayCurrency } from "@/hooks/useDisplayCurrency";

// Inline SVG flags: emoji flags render as plain letters on Windows.
function UsFlag() {
    return (
        <svg viewBox="0 0 19 10" className="size-5 shrink-0 rounded-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            <rect width="19" height="10" fill="#fff" />
            {[0, 2, 4, 6, 8, 10, 12].map((stripe) => (
                <rect key={stripe} y={(stripe * 10) / 13} width="19" height={10 / 13} fill="#b22234" />
            ))}
            <rect width="7.6" height={(7 * 10) / 13} fill="#3c3b6e" />
        </svg>
    );
}

function NgFlag() {
    return (
        <svg viewBox="0 0 3 2" className="size-5 shrink-0 rounded-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            <rect width="3" height="2" fill="#fff" />
            <rect width="1" height="2" fill="#008751" />
            <rect x="2" width="1" height="2" fill="#008751" />
        </svg>
    );
}

const OPTIONS: Array<{ value: DisplayCurrency; label: string; aria: string; Flag: () => React.JSX.Element }> = [
    { value: "USD", label: "USD", aria: "Show in US dollars", Flag: UsFlag },
    { value: "NGN", label: "NGN", aria: "Show in naira", Flag: NgFlag },
];

/** USD / NGN switch for how the dashboard shows money. Display only; billing is unchanged. */
export function CurrencyToggle({ className }: { className?: string }) {
    const { currency, setCurrency, rate } = useDisplayCurrency();
    return (
        <div className={cn("flex w-fit items-center gap-0.5 rounded-full bg-muted/60 p-0.5", className)} role="group" aria-label="Currency">
            {OPTIONS.map(({ value, label, aria, Flag }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => setCurrency(value)}
                    aria-pressed={currency === value}
                    aria-label={aria}
                    title={value === "NGN" ? `Shown at ₦${rate.toLocaleString("en-NG")} per $1, the naira credit rate.` : undefined}
                    className={cn(
                        "flex h-7 items-center gap-1.5 rounded-full pl-1 pr-3 font-inter text-xs font-medium transition-colors",
                        currency === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    <Flag />
                    {label}
                </button>
            ))}
        </div>
    );
}
