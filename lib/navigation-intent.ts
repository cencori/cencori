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

export const SETTINGS_TAB_EVENT = "cencori:settings-tab";

export interface SettingsTabIntent {
    tab: string;
}

/**
 * Switch a settings tab without navigating. The settings page has no tab
 * list of its own — every tab switch used to be a full Link navigation
 * (?tab=X → RSC round trip → skeleton → heavy tab remount). While already
 * on the settings page the sidebar dispatches this instead; the page swaps
 * tab content locally and syncs the URL with replaceState so links stay
 * shareable. Deep links from elsewhere remain normal navigations.
 */
export function announceSettingsTab(tab: string) {
    if (typeof window === "undefined") return;

    window.dispatchEvent(new CustomEvent<SettingsTabIntent>(SETTINGS_TAB_EVENT, {
        detail: { tab },
    }));
}

export function onSettingsTab(listener: (intent: SettingsTabIntent) => void) {
    if (typeof window === "undefined") return () => undefined;

    const handleIntent = (event: Event) => {
        listener((event as CustomEvent<SettingsTabIntent>).detail);
    };

    window.addEventListener(SETTINGS_TAB_EVENT, handleIntent);
    return () => window.removeEventListener(SETTINGS_TAB_EVENT, handleIntent);
}
