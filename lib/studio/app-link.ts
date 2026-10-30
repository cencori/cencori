/**
 * Links back into the Studio mobile app. Sign-in pages (Meta, Composio) only
 * return to https addresses, so they come back to Studio's server, which sends
 * the phone on to `<scheme>://…`; the app's sign-in window is waiting for it.
 * Set STUDIO_APP_SCHEME once the app's name is settled.
 */
export function appScheme(): string {
    return process.env.STUDIO_APP_SCHEME || 'cencori-studio';
}

/** `<scheme>://<path>?<params>`, e.g. appLink('store', { provider: 'square' }). */
export function appLink(path: string, params: Record<string, string>): string {
    return `${appScheme()}://${path}?${new URLSearchParams(params)}`;
}
