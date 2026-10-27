/**
 * A push subscription's endpoint must be a public HTTPS address (the
 * browser's push service: fcm.googleapis.com, web.push.apple.com,
 * updates.push.services.mozilla.com…), never a private or local one, since
 * Cencori's server posts to it.
 */
export function isPublicHttpsUrl(value: string): boolean {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
    // Bare IP addresses (v4 or v6) are never push services.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) return false;
    return host.includes('.');
}
