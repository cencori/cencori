function normalizedOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Resolve a URL on Cencori's public site from either the public site or the
 * console. The console is dashboard-only, so public pages such as /docs must
 * never inherit the console subdomain.
 */
export function getMainSiteUrl(path = "/", currentOrigin?: string): string {
  const runtimeOrigin = normalizedOrigin(
    currentOrigin ?? (typeof window !== "undefined" ? window.location.origin : undefined),
  );

  let mainOrigin: string | null = null;
  if (runtimeOrigin) {
    const runtimeUrl = new URL(runtimeOrigin);
    const hostname = runtimeUrl.hostname.toLowerCase();
    if (hostname === "console.cencori.com" || hostname === "studio.cencori.com") {
      mainOrigin = "https://cencori.com";
    } else if (hostname === "studio.localhost" || (process.env.NODE_ENV !== "production" && hostname.startsWith("studio.") && hostname.endsWith(".sslip.io"))) {
      // Studio in development, on this machine or a phone (lib/studio/routing.ts).
      mainOrigin = `${runtimeUrl.protocol}//${hostname.slice("studio.".length)}${runtimeUrl.port ? `:${runtimeUrl.port}` : ""}`;
    } else if (hostname === "console.localhost") {
      mainOrigin = `http://localhost${runtimeUrl.port ? `:${runtimeUrl.port}` : ""}`;
    } else if (["cencori.com", "www.cencori.com", "localhost", "127.0.0.1", "::1"].includes(hostname) || (process.env.NODE_ENV !== "production" && hostname.endsWith(".sslip.io"))) {
      mainOrigin = runtimeOrigin;
    }
  }

  mainOrigin ??= normalizedOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  mainOrigin ??= process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://cencori.com";

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${mainOrigin}/`).toString();
}
