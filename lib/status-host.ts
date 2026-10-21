/**
 * status.cencori.com serves the branded status page (app/status) at its root:
 *   status.cencori.com/         -> /status
 *   status.cencori.com/history  -> /status/history
 * The main site's /status paths redirect there. Preview deployments have no
 * status subdomain, so they keep serving /status directly.
 */

const STATUS_INTERNAL_PREFIX = '/status';

export function isStatusHostname(hostname: string): boolean {
  const host = hostname.split(':')[0].toLowerCase();
  return host === 'status.cencori.com' || host === 'status.localhost';
}

/** Status subdomain origin for a main-site hostname, or null if there is none. */
export function getStatusOriginForHostname(hostname: string): string | null {
  const [rawHost, port] = hostname.split(':');
  const host = rawHost.toLowerCase();
  if (host === 'cencori.com' || host === 'www.cencori.com') return 'https://status.cencori.com';
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return `http://status.localhost${port ? `:${port}` : ''}`;
  }
  return null;
}

/** Internal route ("/status/history") for a status-subdomain path ("/history"). */
export function statusInternalPath(publicPath: string): string {
  return publicPath === '/' ? STATUS_INTERNAL_PREFIX : `${STATUS_INTERNAL_PREFIX}${publicPath}`;
}

/** Status-subdomain path ("/history") for an internal route ("/status/history"), or null. */
export function statusPublicPath(internalPath: string): string | null {
  if (internalPath === STATUS_INTERNAL_PREFIX) return '/';
  if (internalPath.startsWith(`${STATUS_INTERNAL_PREFIX}/`)) return internalPath.slice(STATUS_INTERNAL_PREFIX.length);
  return null;
}

/** Where the logo goes: the main site's home, which is "/" unless we're on the subdomain. */
export function statusMainSiteHref(hostname: string): string {
  const [rawHost, port] = hostname.split(':');
  const host = rawHost.toLowerCase();
  if (host === 'status.cencori.com') return 'https://cencori.com';
  if (host === 'status.localhost') return `http://localhost${port ? `:${port}` : ''}`;
  return '/';
}

/** Link base for the status pages: "" on the subdomain, "/status" elsewhere. */
export function statusBasePath(hostname: string): string {
  return isStatusHostname(hostname) ? '' : STATUS_INTERNAL_PREFIX;
}
