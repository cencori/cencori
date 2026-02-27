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
        scanMonthly: process.env.POLAR_PRODUCT_SCAN_MONTHLY || '',
        scanTeamMonthly: process.env.POLAR_PRODUCT_SCAN_TEAM_MONTHLY || '',
        creditsStarter: process.env.POLAR_PRODUCT_CREDITS_STARTER || '',
        creditsGrowth: process.env.POLAR_PRODUCT_CREDITS_GROWTH || '',
        creditsScale: process.env.POLAR_PRODUCT_CREDITS_SCALE || '',
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
export type ScanSubscriptionTier = 'scan' | 'scan_team';

export type CreditTopupPack = 'starter' | 'growth' | 'scale';

type CreditTopupPackConfig = {
    productId: string;
    credits: number;
    label: string;
};

export const CREDIT_TOPUP_PACKS: Record<CreditTopupPack, CreditTopupPackConfig> = {
    starter: {
        productId: POLAR_CONFIG.products.creditsStarter,
        credits: 10,
        label: '$10 credits',
    },
    growth: {
        productId: POLAR_CONFIG.products.creditsGrowth,
        credits: 50,
        label: '$50 credits',
    },
    scale: {
        productId: POLAR_CONFIG.products.creditsScale,
        credits: 200,
        label: '$200 credits',
    },
};

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

export function getScanProductId(tier: ScanSubscriptionTier): string | null {
    if (tier === 'scan') {
        return POLAR_CONFIG.products.scanMonthly || null;
    }
    return POLAR_CONFIG.products.scanTeamMonthly || null;
}

export function getScanTierByProductId(productId: string | null | undefined): ScanSubscriptionTier | null {
    if (!productId) {
        return null;
    }

    if (productId === POLAR_CONFIG.products.scanMonthly) {
        return 'scan';
    }

    if (productId === POLAR_CONFIG.products.scanTeamMonthly) {
        return 'scan_team';
    }

    return null;
}

export function getCreditTopupPackConfig(pack: CreditTopupPack): CreditTopupPackConfig | null {
    const config = CREDIT_TOPUP_PACKS[pack];
    if (!config?.productId) {
        return null;
    }

    return config;
}

export function getCreditTopupCreditsByProductId(productId: string | null | undefined): number | null {
    if (!productId) {
        return null;
    }

    for (const config of Object.values(CREDIT_TOPUP_PACKS)) {
        if (config.productId && config.productId === productId) {
            return config.credits;
        }
    }

    return null;
}
