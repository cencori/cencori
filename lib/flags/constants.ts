/**
 * FlagSwift flag that turns Observability on for an organization, targeted by
 * organization slug. This is the flag's key ("observability-beta" is its name
 * in the FlagSwift dashboard).
 */
export const OBSERVABILITY_FLAG = "obs";

/**
 * FlagSwift has two environments, "development" and "production", each with
 * its own switch. Local dev reads Dev; deployed builds read Prod.
 */
export const FLAGSWIFT_ENVIRONMENT =
    process.env.NEXT_PUBLIC_FLAGSWIFT_ENV || (process.env.NODE_ENV === "production" ? "production" : "development");
