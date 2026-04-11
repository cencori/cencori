export const SIGNUP_WELCOME_PENDING_STORAGE_KEY = "cencori.signup.welcome.pending";
export const SIGNUP_NEWSLETTER_OPTIN_STORAGE_KEY = "cencori.signup.newsletter.optin";

export function isSignupWelcomeEmailPending(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIGNUP_WELCOME_PENDING_STORAGE_KEY) === "1";
}

export function markSignupWelcomeEmailPending(): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIGNUP_WELCOME_PENDING_STORAGE_KEY, "1");
}

export function clearSignupWelcomeEmailPending(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SIGNUP_WELCOME_PENDING_STORAGE_KEY);
}

export function isSignupNewsletterOptInPending(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIGNUP_NEWSLETTER_OPTIN_STORAGE_KEY) === "1";
}

export function markSignupNewsletterOptInPending(): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIGNUP_NEWSLETTER_OPTIN_STORAGE_KEY, "1");
}

export function clearSignupNewsletterOptInPending(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SIGNUP_NEWSLETTER_OPTIN_STORAGE_KEY);
}
