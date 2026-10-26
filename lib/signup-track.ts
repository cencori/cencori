/**
 * Which track a sign-up started on, carried from the sign-up page (where
 * business.cencori.com links with ?for=business) to onboarding, through email
 * verification or an OAuth round trip. A cookie on the parent domain, so it
 * survives moving between cencori.com and console.cencori.com.
 */

const COOKIE = "cencori_signup_for";
const MAX_AGE_SECONDS = 60 * 60 * 24;

export type SignupTrack = "business" | "developer";

function domainAttribute(): string {
    if (typeof window === "undefined") return "";
    const host = window.location.hostname;
    return host === "cencori.com" || host.endsWith(".cencori.com") ? "; domain=.cencori.com" : "";
}

/** Remember ?for=business (or developer) from the sign-up URL. */
export function rememberSignupTrack(value: string | null): void {
    if (typeof document === "undefined" || (value !== "business" && value !== "developer")) return;
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax${domainAttribute()}`;
}

export function readSignupTrack(): SignupTrack | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(business|developer)`));
    return (match?.[1] as SignupTrack | undefined) ?? null;
}

export function clearSignupTrack(): void {
    if (typeof document === "undefined") return;
    document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax${domainAttribute()}`;
}
