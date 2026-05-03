export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface TierFeatures {
  security: boolean;
  piiMasking: boolean;
  customDataRules: boolean;
  outputScanning: boolean;
  securityIncidents: boolean;
  auditTrails: boolean;
  failover: boolean;
  customProviders: boolean;
  semanticCache: boolean;
  requestLogs: boolean;
  analyticsDashboard: boolean;
  costTracking: boolean;
  geoAnalytics: boolean;
  failoverAnalytics: boolean;
  promptRegistry: boolean;
  webhooks: boolean;
  sso: boolean;
}

export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    security: false,
    piiMasking: false,
    customDataRules: false,
    outputScanning: false,
    securityIncidents: false,
    auditTrails: false,
    failover: false,
    customProviders: false,
    semanticCache: false,
    requestLogs: false,
    analyticsDashboard: false,
    costTracking: false,
    geoAnalytics: false,
    failoverAnalytics: false,
    promptRegistry: false,
    webhooks: false,
    sso: false,
  },
  pro: {
    security: true,
    piiMasking: true,
    customDataRules: true,
    outputScanning: true,
    securityIncidents: true,
    auditTrails: true,
    failover: true,
    customProviders: false,
    semanticCache: true,
    requestLogs: true,
    analyticsDashboard: true,
    costTracking: true,
    geoAnalytics: false,
    failoverAnalytics: false,
    promptRegistry: true,
    webhooks: false,
    sso: false,
  },
  team: {
    security: true,
    piiMasking: true,
    customDataRules: true,
    outputScanning: true,
    securityIncidents: true,
    auditTrails: true,
    failover: true,
    customProviders: true,
    semanticCache: true,
    requestLogs: true,
    analyticsDashboard: true,
    costTracking: true,
    geoAnalytics: true,
    failoverAnalytics: true,
    promptRegistry: true,
    webhooks: true,
    sso: false,
  },
  enterprise: {
    security: true,
    piiMasking: true,
    customDataRules: true,
    outputScanning: true,
    securityIncidents: true,
    auditTrails: true,
    failover: true,
    customProviders: true,
    semanticCache: true,
    requestLogs: true,
    analyticsDashboard: true,
    costTracking: true,
    geoAnalytics: true,
    failoverAnalytics: true,
    promptRegistry: true,
    webhooks: true,
    sso: true,
  },
};

export function getFeaturesForTier(tier: SubscriptionTier): TierFeatures {
  return TIER_FEATURES[tier] || TIER_FEATURES.free;
}

export function hasFeature(tier: SubscriptionTier, feature: keyof TierFeatures): boolean {
  return getFeaturesForTier(tier)[feature];
}

export function requireFeature(
  tier: SubscriptionTier,
  feature: keyof TierFeatures,
  errorCode: string = 'FEATURE_NOT_INCLUDED'
): void {
  if (!hasFeature(tier, feature)) {
    const featureNames: Record<keyof TierFeatures, string> = {
      security: 'Security scanning',
      piiMasking: 'PII masking',
      customDataRules: 'Custom data rules',
      outputScanning: 'Output scanning',
      securityIncidents: 'Security incidents',
      auditTrails: 'Audit trails',
      failover: 'Failover',
      customProviders: 'Custom providers',
      semanticCache: 'Semantic cache',
      requestLogs: 'Request logs',
      analyticsDashboard: 'Analytics dashboard',
      costTracking: 'Cost tracking',
      geoAnalytics: 'Geo analytics',
      failoverAnalytics: 'Failover analytics',
      promptRegistry: 'Prompt registry',
      webhooks: 'Webhooks',
      sso: 'SSO',
    };
    throw new Error(
      JSON.stringify({
        error: `${featureNames[feature]} requires a paid plan`,
        code: errorCode,
        upgrade_url: '/billing',
      })
    );
  }
}

export const DEFAULT_FEATURES: TierFeatures = TIER_FEATURES.free;