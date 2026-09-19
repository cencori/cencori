export const NAVIGATION_INTENT_EVENT = "cencori:navigation-intent";

export interface NavigationIntent {
    href: string;
}

export function announceNavigationIntent(href: string) {
    if (typeof window === "undefined") return;

    window.dispatchEvent(new CustomEvent<NavigationIntent>(NAVIGATION_INTENT_EVENT, {
        detail: { href },
    }));
}

export function onNavigationIntent(listener: (intent: NavigationIntent) => void) {
    if (typeof window === "undefined") return () => undefined;

    const handleIntent = (event: Event) => {
        listener((event as CustomEvent<NavigationIntent>).detail);
    };

    window.addEventListener(NAVIGATION_INTENT_EVENT, handleIntent);
    return () => window.removeEventListener(NAVIGATION_INTENT_EVENT, handleIntent);
}

export function abortOnNavigationIntent(controller: AbortController) {
    return onNavigationIntent(() => controller.abort());
}

export function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
}
