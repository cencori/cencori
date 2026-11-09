export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface TierFeatures {
  security: boolean;
  piiMasking: boolean;
  customDataRules: boolean;
  outputScanning: boolean;
  securityIncidents: boolean;
  auditTrails: boolean;
  auditLogs: boolean;
  auditLogIdentityEvents: boolean;
  auditLogExtendedHistory: boolean;
  auditLogAllTimeHistory: boolean;
  auditLogExports: boolean;
  auditLogApiAccess: boolean;
  auditLogSiemStreaming: boolean;
  auditLogComplianceArchives: boolean;
  governanceControls: boolean;
  governanceCustomFrameworks: boolean;
  governanceAdvancedEvidence: boolean;
  governanceBespokeControls: boolean;
  failover: boolean;
  customProviders: boolean;
  semanticCache: boolean;
  requestLogs: boolean;
  analyticsDashboard: boolean;
  advancedAnalytics: boolean;
  costTracking: boolean;
  geoAnalytics: boolean;
  failoverAnalytics: boolean;
  promptRegistry: boolean;
  webhooks: boolean;
  sso: boolean;
  teams: boolean;
  embeddedAgents: boolean;
  embeddedSkillLibrary: boolean;
  embeddedSkillImport: boolean;
  embeddedRemoteMcp: boolean;
  embeddedBrowserPolicy: boolean;
  embeddedSubagents: boolean;
}

const ALL_FEATURES_ENABLED: TierFeatures = {
  security: true,
  piiMasking: true,
  customDataRules: true,
  outputScanning: true,
  securityIncidents: true,
  auditTrails: true,
  auditLogs: true,
  auditLogIdentityEvents: true,
  auditLogExtendedHistory: true,
  auditLogAllTimeHistory: true,
  auditLogExports: true,
  auditLogApiAccess: true,
  auditLogSiemStreaming: true,
  auditLogComplianceArchives: true,
  governanceControls: true,
  governanceCustomFrameworks: true,
  governanceAdvancedEvidence: true,
  governanceBespokeControls: true,
  failover: true,
  customProviders: true,
  semanticCache: true,
  requestLogs: true,
  analyticsDashboard: true,
  advancedAnalytics: true,
  costTracking: true,
  geoAnalytics: true,
  failoverAnalytics: true,
  promptRegistry: true,
  webhooks: true,
  sso: true,
  teams: true,
  embeddedAgents: true,
  embeddedSkillLibrary: true,
  embeddedSkillImport: true,
  embeddedRemoteMcp: true,
  embeddedBrowserPolicy: true,
  embeddedSubagents: true,
};

// ─────────────────────────────────────────────────────────────────
// TEMPORARILY UNGATED (2026-07-12, founder decision): most capabilities
// remain available on every tier. The gating misfired repeatedly (request
// logs, analytics, provider keys/BYOK) and read as platform breakage.
//
// Re-gating plan: flip features back per-tier ONE AT A TIME, deliberately,
// with the FeatureUpgradeWall UX (components/billing/FeatureUpgradeWall.tsx)
// wired on every affected page first. The intended future matrix is
// preserved in git history (see this file before this commit).
//
// Explicit existence gates:
//   - security, piiMasking, customDataRules, outputScanning,
//     securityIncidents, auditTrails — Pro and Enterprise
//   - teams — Pro and Enterprise
//   - auditLogs — Pro and Enterprise
//   - auditLogIdentityEvents, auditLogExtendedHistory — Pro and Enterprise
//   - auditLogExports — Enterprise
//   - auditLogAllTimeHistory, auditLogApiAccess, auditLogSiemStreaming,
//     auditLogComplianceArchives — Enterprise
//   - governanceControls — Enterprise. Governance remains
//     readable on Free; organization-wide policy mutations are gated.
//   - governanceCustomFrameworks, governanceAdvancedEvidence,
//     governanceBespokeControls — Enterprise. These sit alongside the
//     Enterprise-only SIEM and compliance-archive infrastructure above.
//
// Team tier (2026-11-09, founder decision): no longer sold or shown. It
// folded into Pro (audit-log identity events and 30/90-day audit history are
// now Pro), and the items the pricing page sells as Enterprise-only stay
// Enterprise: governance controls, audit exports, SSO, all-time history.
// Orgs already on 'team' keep exactly what they had (grandfathered).
//
// Still enforced (depth limits, not existence gates):
//   - MEMORY_QUOTA (below) — memory count per project
//   - LOG_RETENTION_RANGE / clampTimeRange (below) — history depth by tier
//   - spend caps (gateway-middleware)
// ─────────────────────────────────────────────────────────────────
export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    ...ALL_FEATURES_ENABLED,
    sso: false,
    security: false,
    piiMasking: false,
    customDataRules: false,
    outputScanning: false,
    securityIncidents: false,
    auditTrails: false,
    teams: false,
    auditLogs: false,
    auditLogIdentityEvents: false,
    auditLogExtendedHistory: false,
    auditLogAllTimeHistory: false,
    auditLogExports: false,
    auditLogApiAccess: false,
    auditLogSiemStreaming: false,
    auditLogComplianceArchives: false,
    governanceControls: false,
    governanceCustomFrameworks: false,
    governanceAdvancedEvidence: false,
    governanceBespokeControls: false,
  },
  pro: {
    ...ALL_FEATURES_ENABLED,
    sso: false,
    auditLogAllTimeHistory: false,
    auditLogExports: false,
    auditLogApiAccess: false,
    auditLogSiemStreaming: false,
    auditLogComplianceArchives: false,
    governanceControls: false,
    governanceCustomFrameworks: false,
    governanceAdvancedEvidence: false,
    governanceBespokeControls: false,
  },
  // Legacy, grandfathered: see the Team note above.
  team: {
    ...ALL_FEATURES_ENABLED,
    auditLogAllTimeHistory: false,
    auditLogApiAccess: false,
    auditLogSiemStreaming: false,
    auditLogComplianceArchives: false,
    governanceCustomFrameworks: false,
    governanceAdvancedEvidence: false,
    governanceBespokeControls: false,
  },
  enterprise: ALL_FEATURES_ENABLED,
};

export function getFeaturesForTier(tier: SubscriptionTier): TierFeatures {
  return TIER_FEATURES[tier] || TIER_FEATURES.free;
}

// ── Log/analytics retention ──
// Free users get logs and basic analytics; history depth is the upsell.
export type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d' | 'all';

const TIME_RANGE_ORDER: TimeRange[] = ['1h', '24h', '7d', '30d', '90d', 'all'];

export const LOG_RETENTION_RANGE: Record<SubscriptionTier, TimeRange> = {
  free: '7d',
  pro: '30d',
  team: '90d',
  enterprise: 'all',
};

const RETENTION_DAYS: Record<TimeRange, number | null> = {
  '1h': 1 / 24, '24h': 1, '7d': 7, '30d': 30, '90d': 90, all: null,
};

/**
 * The oldest request log a plan can see or export (Free 7 days, Pro 30,
 * Team 90, Enterprise everything), as an ISO time, or null for no limit.
 * Every read of request logs (list, single request, export) starts here.
 */
export function logRetentionCutoff(tier: SubscriptionTier | string | null | undefined, now = Date.now()): string | null {
  const range = LOG_RETENTION_RANGE[(tier as SubscriptionTier)] ?? LOG_RETENTION_RANGE.free;
  const days = RETENTION_DAYS[range];
  return days === null ? null : new Date(now - days * 86_400_000).toISOString();
}

/**
 * Clamp a requested time range to the tier's retention window.
 * Unknown values fall back to the tier's maximum.
 */
export function clampTimeRange(tier: SubscriptionTier, requested: string): TimeRange {
  const max = LOG_RETENTION_RANGE[tier] || LOG_RETENTION_RANGE.free;
  const requestedIdx = TIME_RANGE_ORDER.indexOf(requested as TimeRange);
  const maxIdx = TIME_RANGE_ORDER.indexOf(max);
  if (requestedIdx === -1 || requestedIdx > maxIdx) {
    return max;
  }
  return TIME_RANGE_ORDER[requestedIdx];
}

export function hasFeature(tier: SubscriptionTier, feature: keyof TierFeatures): boolean {
  return getFeaturesForTier(tier)[feature];
}

// ── Memory quotas ──
// Memory is available on every tier (API opt-in); the quota is the gate.
// Metered by count of memories per project, 10KB content cap per memory.
export const MEMORY_QUOTA: Record<SubscriptionTier, number> = {
  free: 1_000,
  pro: 50_000,
  team: 100_000,
  enterprise: Number.POSITIVE_INFINITY,
};

export function getMemoryQuota(tier: SubscriptionTier): number {
  return MEMORY_QUOTA[tier] ?? MEMORY_QUOTA.free;
}

// ── Memory operations quotas ──
// Stored count (MEMORY_QUOTA) caps what sits in the DB; operations cap what
// runs on the shared managed keys. Every opted-in turn costs ~2–3 managed
// LLM calls (extraction + reconciliation, +1 with the entity graph on) plus
// embeddings — billed to the org's prepaid credits (memory/writeback.ts →
// incrementUsage). Without an ops cap, one hot tenant can burn the shared
// Groq/Cerebras/Gemini quota (MON-6). Paid allowances are sized so a fully
// maxed project's monthly background LLM COGS stays bounded against plan
// revenue (pro: searches ≈ $7.5, writes ≈ $15 on $29; team: ≈ $30 + $30 on
// $99; median usage sits far below). Two dimensions: per-project monthly (protects the
// shared keys) and per end-user daily (protects against a single hot user).
// Both enforced in lib/memory/ops-quota.ts via the shared Redis fixed-window
// limiter.
export interface MemoryOpsQuota {
  searches: number;
  writes: number;
}

export const MEMORY_OPS_QUOTA: Record<SubscriptionTier, MemoryOpsQuota> = {
  free: { searches: 2_000, writes: 1_000 },
  pro: { searches: 50_000, writes: 5_000 },
  team: { searches: 200_000, writes: 10_000 },
  enterprise: { searches: Number.POSITIVE_INFINITY, writes: Number.POSITIVE_INFINITY },
};

export function getMemoryOpsQuota(tier: SubscriptionTier): MemoryOpsQuota {
  return MEMORY_OPS_QUOTA[tier] ?? MEMORY_OPS_QUOTA.free;
}

export const MEMORY_OPS_USER_DAILY_QUOTA: Record<SubscriptionTier, MemoryOpsQuota> = {
  free: { searches: 200, writes: 100 },
  pro: { searches: 2_000, writes: 1_000 },
  team: { searches: 10_000, writes: 5_000 },
  enterprise: { searches: Number.POSITIVE_INFINITY, writes: Number.POSITIVE_INFINITY },
};

export function getMemoryOpsUserDailyQuota(tier: SubscriptionTier): MemoryOpsQuota {
  return MEMORY_OPS_USER_DAILY_QUOTA[tier] ?? MEMORY_OPS_USER_DAILY_QUOTA.free;
}

// ── Embedded Agents limits (M4) ──
// The capability is available on every tier (developer preview); the caps are
// the gate. Metered per project/tenant/installation; runs additionally carry a
// per-minute rate + concurrency cap for fair scheduling across tenants.
export interface EmbeddedLimits {
  /** Agents per organization (Free 1, Pro 10; set 2026-11-09). */
  maxAgents: number;
  maxTenants: number;
  maxInstallationsPerTenant: number;
  maxProviderConnections: number;
  maxKnowledgeBases: number;
  maxSkills: number;
  maxDelegationDepth: number;
  runsPerMinute: number;
  maxConcurrentRuns: number;
}

export const EMBEDDED_LIMITS: Record<SubscriptionTier, EmbeddedLimits> = {
  free: { maxAgents: 1, maxTenants: 5, maxInstallationsPerTenant: 5, maxProviderConnections: 2, maxKnowledgeBases: 5, maxSkills: 20, maxDelegationDepth: 1, runsPerMinute: 10, maxConcurrentRuns: 1 },
  pro: { maxAgents: 10, maxTenants: 100, maxInstallationsPerTenant: 20, maxProviderConnections: 10, maxKnowledgeBases: 100, maxSkills: 200, maxDelegationDepth: 3, runsPerMinute: 60, maxConcurrentRuns: 10 },
  team: { maxAgents: Number.POSITIVE_INFINITY, maxTenants: 1000, maxInstallationsPerTenant: 50, maxProviderConnections: 25, maxKnowledgeBases: 500, maxSkills: 1000, maxDelegationDepth: 5, runsPerMinute: 300, maxConcurrentRuns: 25 },
  enterprise: { maxAgents: Number.POSITIVE_INFINITY, maxTenants: Number.POSITIVE_INFINITY, maxInstallationsPerTenant: Number.POSITIVE_INFINITY, maxProviderConnections: Number.POSITIVE_INFINITY, maxKnowledgeBases: Number.POSITIVE_INFINITY, maxSkills: Number.POSITIVE_INFINITY, maxDelegationDepth: Number.POSITIVE_INFINITY, runsPerMinute: Number.POSITIVE_INFINITY, maxConcurrentRuns: Number.POSITIVE_INFINITY },
};

export function getEmbeddedLimits(tier: SubscriptionTier): EmbeddedLimits {
  return EMBEDDED_LIMITS[tier] ?? EMBEDDED_LIMITS.free;
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
      auditLogs: 'Organization audit log',
      auditLogIdentityEvents: 'Identity audit events',
      auditLogExtendedHistory: 'Extended audit-log history',
      auditLogAllTimeHistory: 'All-time audit-log history',
      auditLogExports: 'Audit-log exports',
      auditLogApiAccess: 'Audit API access',
      auditLogSiemStreaming: 'SIEM streaming',
      auditLogComplianceArchives: 'Compliance-grade audit archives',
      governanceControls: 'Governance control access',
      governanceCustomFrameworks: 'Custom governance frameworks',
      governanceAdvancedEvidence: 'Advanced governance evidence',
      governanceBespokeControls: 'Bespoke governance controls',
      failover: 'Failover',
      customProviders: 'Custom providers',
      semanticCache: 'Semantic cache',
      requestLogs: 'Request logs',
      analyticsDashboard: 'Analytics dashboard',
      advancedAnalytics: 'Advanced analytics',
      costTracking: 'Cost tracking',
      geoAnalytics: 'Geo analytics',
      failoverAnalytics: 'Failover analytics',
      promptRegistry: 'Prompt registry',
      webhooks: 'Webhooks',
      sso: 'SSO',
      teams: 'Team collaboration',
      embeddedAgents: 'Embedded Agents',
      embeddedSkillLibrary: 'Embedded skill library',
      embeddedSkillImport: 'Embedded skill imports',
      embeddedRemoteMcp: 'Embedded remote MCP',
      embeddedBrowserPolicy: 'Embedded browser/network policy',
      embeddedSubagents: 'Embedded subagents',
    };
    throw new Error(
      JSON.stringify({
        error: `${featureNames[feature]} requires ${feature === 'governanceControls'
          ? 'the Enterprise plan'
          : feature === 'governanceCustomFrameworks'
            || feature === 'governanceAdvancedEvidence'
            || feature === 'governanceBespokeControls'
            ? 'the Enterprise plan'
            : 'a paid plan'}`,
        code: errorCode,
        upgrade_url: '/billing',
      })
    );
  }
}

export const DEFAULT_FEATURES: TierFeatures = TIER_FEATURES.free;
