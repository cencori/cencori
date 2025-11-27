import { Polar } from '@polar-sh/sdk';

// Initialize Polar client with access token
export const polarClient = new Polar({
    accessToken: process.env.POLAR_API_KEY!,
});

// Polar configuration
export const POLAR_CONFIG = {
    organizationId: process.env.POLAR_ORGANIZATION_ID!,
    products: {
        proMonthly: process.env.POLAR_PRODUCT_PRO_MONTHLY!,
        proAnnual: process.env.POLAR_PRODUCT_PRO_ANNUAL!,
        teamMonthly: process.env.POLAR_PRODUCT_TEAM_MONTHLY!,
        teamAnnual: process.env.POLAR_PRODUCT_TEAM_ANNUAL!,
    },
};

// Tier limits (requests per month)
export const TIER_LIMITS = {
    free: 1000,
    pro: 50000,
    team: 250000,
    enterprise: 999999999,
} as const;

export type SubscriptionTier = keyof typeof TIER_LIMITS;

// Helper to get limit for a tier
export function getLimitForTier(tier: SubscriptionTier): number {
    return TIER_LIMITS[tier];
}

// Helper to get product ID for tier and billing cycle
export function getProductId(tier: 'pro' | 'team', cycle: 'monthly' | 'annual'): string {
    if (tier === 'pro') {
        return cycle === 'monthly' ? POLAR_CONFIG.products.proMonthly : POLAR_CONFIG.products.proAnnual;
    }
    return cycle === 'monthly' ? POLAR_CONFIG.products.teamMonthly : POLAR_CONFIG.products.teamAnnual;
}
