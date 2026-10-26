/**
 * The two front doors: developers.cencori.com (building with the API) and
 * business.cencori.com (agents for a business). Each is a section of the
 * marketing site served from the root of its own subdomain; everything else
 * a visitor clicks on there (docs, pricing, sign-up) lives on cencori.com.
 */

export type MarketingSubdomain = "developers" | "business";

/** Pages under /developers (keep in sync with app/(marketing)/developers; a test checks). */
export const DEVELOPER_PAGES = ["", "blog", "apis", "inference", "agent-deployment", "web-tools", "multimodal", "voice", "billing", "observability", "sdks", "cli", "mcp"] as const;

/** Pages under /business. */
export const BUSINESS_PAGES = [""] as const;

const PAGES: Record<MarketingSubdomain, readonly string[]> = { developers: DEVELOPER_PAGES, business: BUSINESS_PAGES };

export function marketingSubdomainFor(domain: string): MarketingSubdomain | null {
    for (const name of ["developers", "business"] as const) {
        if (domain === `${name}.cencori.com` || domain === `${name}.localhost`) return name;
    }
    return null;
}

export type SubdomainRoute =
    | { kind: "rewrite"; pathname: string }
    | { kind: "redirect"; pathname: string; host: "self" | "main" };

/**
 * Where a request on a front-door subdomain goes: its own pages are served
 * from the root (developers.cencori.com/apis → /developers/apis), old
 * /developers/… links drop the prefix, and anything else goes to cencori.com.
 */
export function routeMarketingSubdomain(name: MarketingSubdomain, pathname: string): SubdomainRoute {
    const prefix = `/${name}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return { kind: "redirect", host: "self", pathname: pathname.slice(prefix.length) || "/" };
    }
    const page = pathname.replace(/^\/+|\/+$/g, "");
    if (PAGES[name].includes(page)) return { kind: "rewrite", pathname: page ? `${prefix}/${page}` : prefix };
    return { kind: "redirect", host: "main", pathname };
}

/** cencori.com/developers/… and /business → the subdomain (production hosts only). */
export function mainSiteSubdomainRedirect(domain: string, pathname: string): { host: string; pathname: string } | null {
    if (domain !== "cencori.com" && domain !== "www.cencori.com") return null;
    for (const name of ["developers", "business"] as const) {
        const prefix = `/${name}`;
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
            return { host: `${name}.cencori.com`, pathname: pathname.slice(prefix.length) || "/" };
        }
    }
    return null;
}
