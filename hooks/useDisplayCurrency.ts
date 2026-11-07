"use client";

import { createContext, createElement, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { formatCurrency } from "@/lib/currency";
import { CREDIT_NGN_PER_USD } from "@/lib/billing/credit-pricing";

/**
 * Which currency the dashboard shows money in: dollars, or naira. Display
 * only. Balances and charges stay in dollars.
 *
 * Naira is shown at the rate naira credit packs are sold at
 * (CREDIT_NGN_PER_USD), not the market rate, so a balance reads in the naira
 * the customer actually paid: a ₦15,000 Starter pack shows as ₦14,175
 * (₦15,000 less the card top-up fee), not the lower market value.
 *
 * The choice is remembered per browser. Until someone picks, it follows the
 * visitor's country: naira in Nigeria, dollars everywhere else. The country
 * is read on the server (DisplayCurrencyProvider) so the first render
 * already shows the right currency, with no flash.
 * Every component using this hook (top-bar pill, credits card, spend tile,
 * budget settings) switches together.
 */

export type DisplayCurrency = "USD" | "NGN";

const STORAGE_KEY = "cencori:display-currency";
const CHANGE_EVENT = "cencori:display-currency-change";

function readStored(): DisplayCurrency | null {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return value === "USD" || value === "NGN" ? value : null;
    } catch {
        return null;
    }
}

function subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE_EVENT, onChange);
    };
}

/** The currency for a visitor who hasn't picked one, from their country. */
export function defaultCurrencyForCountry(country: string | null | undefined): DisplayCurrency {
    return country?.toUpperCase() === "NG" ? "NGN" : "USD";
}

const DefaultCurrencyContext = createContext<DisplayCurrency>("USD");

/** Supplies the country-based default; wrap the dashboard with it. */
export function DisplayCurrencyProvider({ country, children }: { country: string | null; children: ReactNode }) {
    return createElement(DefaultCurrencyContext.Provider, { value: defaultCurrencyForCountry(country) }, children);
}

export function useDisplayCurrency() {
    const stored = useSyncExternalStore(subscribe, readStored, () => null);
    const fallback = useContext(DefaultCurrencyContext);
    const currency: DisplayCurrency = stored ?? fallback;
    const rate = CREDIT_NGN_PER_USD;

    const setCurrency = useCallback((next: DisplayCurrency) => {
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage blocked: nothing to remember the choice in.
        }
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    /** Format a dollar amount in the chosen display currency. */
    const formatMoney = useCallback(
        (usd: number) => {
            if (currency === "NGN") {
                const naira = usd * rate;
                // Whole naira once the amount is large enough that kobo is noise.
                const digits = Math.abs(naira) >= 1000 ? 0 : 2;
                return formatCurrency(naira, "NGN", {
                    minimumFractionDigits: digits,
                    maximumFractionDigits: digits,
                });
            }
            return formatCurrency(usd, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },
        [currency, rate],
    );

    return { currency, setCurrency, formatMoney, rate };
}
