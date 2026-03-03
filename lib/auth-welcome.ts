export const SIGNUP_WELCOME_PENDING_STORAGE_KEY = "cencori.signup.welcome.pending";

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
