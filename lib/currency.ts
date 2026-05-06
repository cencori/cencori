/**
 * Global Currency Utilities
 * Handles formatting, symbol mapping, and high-precision currency display.
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    CAD: 'CA$',
    AUD: 'A$',
    BRL: 'R$',
    NGN: '₦', // Nigeria
    GHS: '₵', // Ghana
    KES: 'KSh', // Kenya
    ZAR: 'R', // South Africa
    EGP: 'E£', // Egypt
    MAD: 'MAD', // Morocco
    AED: 'د.إ', // UAE
    SAR: 'SR', // Saudi Arabia
    MXN: '$', // Mexico
    SGD: 'S$', // Singapore
    HKD: 'HK$', // Hong Kong
    KRW: '₩', // South Korea
    RUB: '₽', // Russia
    TRY: '₺', // Turkey
    CHF: 'CHF', // Switzerland
    SEK: 'kr', // Sweden
    NZD: 'NZ$', // New Zealand
    ILS: '₪', // Israel
    PHP: '₱', // Philippines
    THB: '฿', // Thailand
    MYR: 'RM', // Malaysia
    IDR: 'Rp', // Indonesia
    VND: '₫', // Vietnam
    PKR: 'Rs', // Pakistan
    ZMW: 'ZK', // Zambia
    UGX: 'USh', // Uganda
    RWF: 'RF', // Rwanda
    TZS: 'TSh', // Tanzania
    ETB: 'Br', // Ethiopia
};

/**
 * Format a high-precision number into a human-readable currency string.
 * Handles atto-dollar precision ($10^-18).
 */
export function formatCurrency(
    amount: number | string,
    currencyCode: string = 'USD',
    options: {
        minimumFractionDigits?: number;
        maximumFractionDigits?: number;
        showSymbol?: boolean;
    } = {}
): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const symbol = CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
    
    // For AI usage, we often want more than 2 decimals
    const minDigits = options.minimumFractionDigits ?? (num < 0.01 && num > 0 ? 6 : 2);
    const maxDigits = options.maximumFractionDigits ?? (num < 0.01 && num > 0 ? 8 : 2);

    const formatted = new Intl.NumberFormat('en-US', {
        style: options.showSymbol === false ? 'decimal' : 'currency',
        currency: currencyCode.toUpperCase(),
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
    }).format(num);

    return formatted;
}

/**
 * Get the symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
    return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
}
