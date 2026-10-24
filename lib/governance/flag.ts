/**
 * Deployment-wide switch for governance (policy enforcement + the immutable
 * audit ledger). Off unless GOVERNANCE_ENABLED=true: with no customer using
 * policies, the per-request ledger write was pure database load. Turning it on
 * restores enforcement, ledger recording, and the /v1/governance API as-is.
 */
export function isGovernanceEnabled(): boolean {
    return process.env.GOVERNANCE_ENABLED === 'true';
}
