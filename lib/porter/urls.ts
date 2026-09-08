export function normalizePorterHost(host: string): string {
    return host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

/** Compare apex/www consistently while preserving query strings that identify different pages. */
export function normalizePorterUrl(value: string, host: string): string | null {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        if (normalizePorterHost(url.hostname) !== normalizePorterHost(host)) return null;
        url.hostname = normalizePorterHost(url.hostname);
        url.hash = '';
        url.pathname = url.pathname.replace(/\/$/, '') || '/';
        return url.toString();
    } catch {
        return null;
    }
}
