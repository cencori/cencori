/**
 * A logo for an MCP server, found once when it's connected (or refreshed) and
 * stored with it as a small data URL, so the console never loads images from
 * the server's site or anyone else at view time.
 *
 * Where it comes from, best first:
 * 1. The server's own icons (`serverInfo.icons`, MCP 2025-11-25).
 * 2. Its brand's favicon (the domain without `mcp.`/`api.`), from Google's
 *    favicon service: one server-side request per connect that only names
 *    the domain. Brand homepages are too slow and heavy to read (several
 *    seconds from here), and this has high-resolution icons for nearly all.
 * 3. The brand site's /apple-touch-icon.png.
 *
 * Best-effort throughout, within a time budget: no icon just means the
 * generic one.
 */

import { safeOutboundFetch } from '@/lib/security/outbound-url';

const FETCH_TIMEOUT_MS = 6_000;
/** The server's own icons are tried first, but not waited on for long. */
const OWN_ICONS_TIMEOUT_MS = 3_000;
/** Bytes read from a candidate image, and stored after resizing. */
const IMAGE_READ_MAX = 512_000;
const ICON_STORE_MAX = 16_000;
const ICON_PX = 64;
/** The most a connect waits for a logo; it never holds up connecting beyond this. */
const ICON_BUDGET_MS = 8_000;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);
/** Subdomains that host the MCP endpoint, not the brand. */
const SERVICE_LABELS = new Set(['mcp', 'api', 'www', 'app', 'server', 'remote', 'gateway']);

/** Read a body up to `max` bytes; anything bigger is no use as an icon (null). */
async function readCapped(response: Response, max: number): Promise<Buffer | null> {
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > max) return null;
            chunks.push(value);
        }
    } catch {
        return null;
    } finally {
        await reader.cancel().catch(() => undefined);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function fetchCapped(url: string, max: number, accept: string): Promise<{ body: Buffer; type: string } | null> {
    try {
        const response = await safeOutboundFetch(url, { headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (compatible; Cencori/1.0; +https://cencori.com)' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }, { maxRedirects: 3 });
        if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            return null;
        }
        const body = await readCapped(response, max);
        return body ? { body, type: (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() } : null;
    } catch {
        return null;
    }
}

/** `mcp.linear.app` → `linear.app`; `api.githubcopilot.com` → `githubcopilot.com`. Keeps at least two labels. */
export function brandDomain(serverUrl: string): string {
    const labels = new URL(serverUrl).hostname.split('.');
    while (labels.length > 2 && SERVICE_LABELS.has(labels[0])) labels.shift();
    return labels.join('.');
}

/** Shrink to a small square PNG when sharp is available; otherwise keep small originals. */
async function toStoredIcon(body: Buffer, type: string): Promise<string | null> {
    if (!IMAGE_TYPES.has(type) && !/^image\//.test(type)) return null;
    try {
        const sharp = (await import('sharp')).default;
        // ICO isn't decoded by sharp; those fall through to the size check below.
        if (type !== 'image/x-icon' && type !== 'image/vnd.microsoft.icon') {
            const png = await sharp(body, { density: 192 }).resize(ICON_PX, ICON_PX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
            if (png.byteLength <= ICON_STORE_MAX) return `data:image/png;base64,${png.toString('base64')}`;
        }
    } catch {
        // No sharp, or an image it can't read.
    }
    if (body.byteLength > ICON_STORE_MAX || !IMAGE_TYPES.has(type)) return null;
    return `data:${type};base64,${body.toString('base64')}`;
}

async function iconFrom(url: string): Promise<string | null> {
    if (url.startsWith('data:image/')) return url.length <= ICON_STORE_MAX * 1.4 ? url : null;
    const image = await fetchCapped(url, IMAGE_READ_MAX, 'image/*');
    return image ? toStoredIcon(image.body, image.type || (url.endsWith('.ico') ? 'image/x-icon' : '')) : null;
}

/** The server's own icons from `initialize` (servers that answer it without a session or with the given headers). */
async function serverInfoIcons(serverUrl: string, headers: Record<string, string>): Promise<string[]> {
    try {
        const response = await safeOutboundFetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'cencori', version: '1.0' } } }),
            signal: AbortSignal.timeout(OWN_ICONS_TIMEOUT_MS),
        });
        if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            return [];
        }
        const text = (await readCapped(response, 200_000))?.toString('utf8') ?? '';
        const json = text.trimStart().startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data:'))?.slice(5) ?? '';
        const icons = (JSON.parse(json) as { result?: { serverInfo?: { icons?: Array<{ src?: unknown; sizes?: unknown }> } } }).result?.serverInfo?.icons ?? [];
        return icons
            .filter((icon) => typeof icon?.src === 'string')
            .sort((a, b) => Number(String(b.sizes ?? '').split('x')[0] || 0) - Number(String(a.sizes ?? '').split('x')[0] || 0))
            .map((icon) => new URL(icon.src as string, serverUrl).toString());
    } catch {
        return [];
    }
}

/** The first that resolves to a value, in the given order of preference, once earlier ones have failed. */
async function firstInOrder(attempts: Array<Promise<string | null>>): Promise<string | null> {
    for (const attempt of attempts) {
        const value = await attempt;
        if (value) return value;
    }
    return null;
}

/** Google's favicon for a domain at up to 128px; 404 (no icon) for domains it doesn't know. */
function faviconServiceUrl(domain: string): string {
    return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${domain}`)}&size=128`;
}

/**
 * Find and store a logo for the server. Null when nothing usable turns up
 * within the time budget. Sources load side by side; the best one wins.
 */
export async function fetchMcpServerIcon(serverUrl: string, headers: Record<string, string> = {}): Promise<string | null> {
    const domain = brandDomain(serverUrl);
    const own = serverInfoIcons(serverUrl, headers).then((sources) => firstInOrder(sources.slice(0, 3).map((src) => iconFrom(src))));
    const found = firstInOrder([own, iconFrom(faviconServiceUrl(domain)), iconFrom(`https://${domain}/apple-touch-icon.png`)]);
    const budget = new Promise<null>((resolve) => setTimeout(() => resolve(null), ICON_BUDGET_MS));
    return Promise.race([found, budget]);
}

/** A stored icon read back from config: only our own small image data URLs. */
export function readStoredIcon(value: unknown): string | null {
    return typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= ICON_STORE_MAX * 1.4 + 64
        ? value
        : null;
}
