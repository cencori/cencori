/**
 * Photos for what Tensor builds, from Pexels (https://www.pexels.com/api/documentation/).
 *
 * Tensor's agent asks here, on Cencori, so the Pexels key stays on Cencori and never lands in a
 * sandbox or someone's project. Pexels photos are free to use and to download, credit not
 * required, so the agent saves the photo it chooses into the project rather than linking to
 * Pexels: a published site keeps its images whatever happens to Pexels.
 */

export type ImageOrientation = "landscape" | "portrait" | "square";

export type ImageResult = {
  id: string;
  /** What the photo shows, in Pexels' words. Often a fair start for alt text. */
  description: string;
  width: number;
  height: number;
  /** The photo's average colour, for a placeholder while it loads. */
  color: string | null;
  photographer: string;
  photographerUrl: string;
  /** The photo's page on Pexels. */
  pageUrl: string;
  /** Sizes to download: large (~940px wide), large2x (~1880px), original (full size). */
  src: { small: string; medium: string; large: string; large2x: string; original: string };
};

const ORIENTATIONS = new Set<ImageOrientation>(["landscape", "portrait", "square"]);
export const MAX_IMAGE_RESULTS = 12;
export const MAX_IMAGE_QUERY = 120;

export type ImageSearchInput = { query: string; orientation?: ImageOrientation; count: number; page: number };

/** A search request's body, cleaned; or what is wrong with it. */
export function readImageSearch(body: unknown): ImageSearchInput | { error: string } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const query = typeof record.query === "string" ? record.query.replace(/\s+/g, " ").trim() : "";
  if (!query) return { error: "Say what the photo should show." };
  if (query.length > MAX_IMAGE_QUERY) return { error: `Keep the search under ${MAX_IMAGE_QUERY} characters.` };
  const orientation =
    typeof record.orientation === "string" && ORIENTATIONS.has(record.orientation as ImageOrientation)
      ? (record.orientation as ImageOrientation)
      : undefined;
  const whole = (value: unknown, fallback: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(1, Math.floor(value))) : fallback;
  return { query, orientation, count: whole(record.count, 6, MAX_IMAGE_RESULTS), page: whole(record.page, 1, 20) };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Pexels' photo, as Tensor hands it on; null for anything missing what a photo needs. */
export function imageFromPexels(photo: unknown): ImageResult | null {
  if (!photo || typeof photo !== "object") return null;
  const record = photo as Record<string, unknown>;
  const src = (record.src && typeof record.src === "object" ? record.src : {}) as Record<string, unknown>;
  const original = text(src.original);
  if (!original || typeof record.id !== "number") return null;
  return {
    id: String(record.id),
    description: text(record.alt).trim(),
    width: typeof record.width === "number" ? record.width : 0,
    height: typeof record.height === "number" ? record.height : 0,
    color: text(record.avg_color) || null,
    photographer: text(record.photographer),
    photographerUrl: text(record.photographer_url),
    pageUrl: text(record.url),
    src: {
      small: text(src.small) || original,
      medium: text(src.medium) || original,
      large: text(src.large) || original,
      large2x: text(src.large2x) || original,
      original,
    },
  };
}

export class ImageSearchUnavailable extends Error {}

export async function searchPexels(input: ImageSearchInput, apiKey: string): Promise<ImageResult[]> {
  const params = new URLSearchParams({ query: input.query, per_page: String(input.count), page: String(input.page) });
  if (input.orientation) params.set("orientation", input.orientation);
  const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!response) throw new ImageSearchUnavailable("Pexels didn't answer.");
  if (response.status === 429) throw new ImageSearchUnavailable("Pexels' hourly limit is used up.");
  if (!response.ok) throw new ImageSearchUnavailable(`Pexels answered ${response.status}.`);
  const json = (await response.json().catch(() => null)) as { photos?: unknown[] } | null;
  return (json?.photos ?? []).map(imageFromPexels).filter((photo): photo is ImageResult => photo !== null);
}
