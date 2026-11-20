import dns from "node:dns";
import https from "node:https";
import net from "node:net";

/**
 * Finding an app's logo from its website, so a developer does not have to upload one.
 *
 * The website address is whatever the developer typed, and this code fetches it from our
 * servers, so it must not be able to reach anything a stranger could not: only https, only
 * public addresses (checked on the address actually connected to, so a name that resolves to a
 * private address is refused), a few redirects, a short timeout and a small size.
 */

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 512 * 1024;
export const MAX_ICON_BYTES = 1024 * 1024;

export type SiteIcon = { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp"; extension: "png" | "jpg" | "webp" };

/** Whether an IP address is one only this machine or its private network can reach. */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, where cloud metadata lives
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") || // unique local
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") || // link-local
      lower.startsWith("ff") || // multicast
      lower.startsWith("::ffff:") // any other mapped form
    );
  }
  return true;
}

/** A DNS lookup that refuses a name unless every address it resolves to is public. */
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses as unknown as string, family: 4 }];
    if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
      return callback(new Error("The address is not public"), "", 4);
    }
    if ((options as dns.LookupOptions).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    }
    callback(null, list[0].address, list[0].family);
  });
};

function isFetchable(url: URL): boolean {
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A bare IP address is checked here; a name is checked when it is resolved.
  if (net.isIP(host)) return !isPrivateAddress(host);
  return host.includes(".") && !host.endsWith(".local") && !host.endsWith(".internal");
}

type Fetched = { url: URL; contentType: string; body: Buffer };

function getOnce(url: URL, maxBytes: number): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        lookup: publicLookup,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": "CencoriBot/1.0 (+https://cencori.com/docs/oauth)", Accept: "*/*" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(new Error("The response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location,
            contentType: String(response.headers["content-type"] ?? "").toLowerCase(),
            body: Buffer.concat(chunks),
          }),
        );
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("The request timed out")));
    request.on("error", reject);
    // A slow server cannot hold the request open by trickling bytes.
    setTimeout(() => request.destroy(new Error("The request timed out")), TIMEOUT_MS * 2).unref();
  });
}

async function get(start: URL, maxBytes: number): Promise<Fetched | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isFetchable(url)) return null;
    const response = await getOnce(url, maxBytes);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = new URL(response.location, url);
      continue;
    }
    if (response.status !== 200) return null;
    return { url, contentType: response.contentType, body: response.body };
  }
  return null;
}

/** The kind of image these bytes are, by their first bytes, whatever the server called them. */
export function sniffImage(bytes: Buffer): Pick<SiteIcon, "contentType" | "extension"> | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

/**
 * The icons a page names in its <head>, best first: the touch icon (made to be shown large),
 * then ordinary icons from largest to smallest. SVG and .ico are left out: an SVG can carry
 * script, and neither is something this stores.
 */
export function iconCandidates(html: string, pageUrl: URL): URL[] {
  const found: Array<{ url: URL; score: number }> = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attribute = (name: string) =>
      tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(2).find((value) => value !== undefined);
    const rel = (attribute("rel") ?? "").toLowerCase();
    const href = attribute("href");
    if (!href || !/\bicon\b/.test(rel)) continue;
    if (rel.includes("mask-icon")) continue;
    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (/\.(svg|ico)$/i.test(url.pathname) || (attribute("type") ?? "").toLowerCase().includes("svg")) continue;
    const size = Number((attribute("sizes") ?? "").match(/(\d+)x\d+/)?.[1] ?? 0);
    found.push({ url, score: (rel.includes("apple-touch-icon") ? 1000 : 0) + Math.min(size, 512) });
  }
  found.sort((a, b) => b.score - a.score);
  const ordered = found.map((item) => item.url);
  // Where a touch icon is by convention, for a page that does not name one.
  ordered.push(new URL("/apple-touch-icon.png", pageUrl));
  const seen = new Set<string>();
  return ordered.filter((url) => (seen.has(url.href) ? false : (seen.add(url.href), true))).slice(0, 5);
}

/**
 * The icon of a website, or null when it has none this can use. Never throws: a site that is
 * down or has no icon means an app without a logo, not a failed save.
 */
export async function fetchSiteIcon(websiteUrl: string): Promise<SiteIcon | null> {
  try {
    const page = await get(new URL(websiteUrl), MAX_PAGE_BYTES);
    if (!page) return null;
    for (const candidate of iconCandidates(page.body.toString("utf8"), page.url)) {
      const icon = await get(candidate, MAX_ICON_BYTES).catch(() => null);
      if (!icon) continue;
      const kind = sniffImage(icon.body);
      if (kind) return { bytes: icon.body, ...kind };
    }
    return null;
  } catch {
    return null;
  }
}
