/**
 * Photos for what Tensor builds, from Pexels (https://www.pexels.com/api/documentation/) when
 * Cencori has a Pexels key, otherwise from Pixabay (https://pixabay.com/api/docs/).
 *
 * Tensor's agent asks here, on Cencori, so the key stays on Cencori and never lands in a sandbox
 * or someone's project. Both libraries' photos are free to use and to download, credit not
 * required, so the agent saves the photo it chooses into the project rather than linking to it:
 * a published site keeps its images whatever happens to the library. (Pixabay asks for exactly
 * that: no permanent hotlinking.)
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

/** Pixabay's photo, as Tensor hands it on; null for anything missing what a photo needs. */
export function imageFromPixabay(hit: unknown): ImageResult | null {
  if (!hit || typeof hit !== "object") return null;
  const record = hit as Record<string, unknown>;
  const large = text(record.largeImageURL);
  const web = text(record.webformatURL);
  if (!large || typeof record.id !== "number") return null;
  const user = text(record.user);
  const userId = typeof record.user_id === "number" ? record.user_id : null;
  const tags = text(record.tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    id: String(record.id),
    // Pixabay describes a photo only by its tags.
    description: tags.length ? `Tagged: ${tags.join(", ")}` : "",
    width: typeof record.imageWidth === "number" ? record.imageWidth : 0,
    height: typeof record.imageHeight === "number" ? record.imageHeight : 0,
    color: null,
    photographer: user,
    photographerUrl: user && userId !== null ? `https://pixabay.com/users/${user}-${userId}/` : "",
    pageUrl: text(record.pageURL),
    // webformat is 640px on its long side, large 1280px: what Pixabay gives without full access.
    src: { small: text(record.previewURL) || web || large, medium: web || large, large, large2x: large, original: large },
  };
}

/** Whether a photo's shape fits the orientation asked for. Pixabay has no "square" of its own. */
function fits(image: ImageResult, orientation?: ImageOrientation): boolean {
  if (orientation !== "square") return true;
  if (!image.width || !image.height) return false;
  const ratio = image.width / image.height;
  return ratio > 0.8 && ratio < 1.25;
}

export async function searchPixabay(input: ImageSearchInput, apiKey: string): Promise<ImageResult[]> {
  const square = input.orientation === "square";
  const params = new URLSearchParams({
    key: apiKey,
    q: input.query,
    image_type: "photo",
    safesearch: "true",
    // Pixabay returns at least 3; a square search takes more and keeps the square ones.
    per_page: String(Math.max(3, square ? 40 : input.count)),
    page: String(input.page),
  });
  if (input.orientation === "landscape") params.set("orientation", "horizontal");
  if (input.orientation === "portrait") params.set("orientation", "vertical");
  const response = await fetch(`https://pixabay.com/api/?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!response) throw new ImageSearchUnavailable("Pixabay didn't answer.");
  if (response.status === 429) throw new ImageSearchUnavailable("Pixabay's limit is used up.");
  if (!response.ok) throw new ImageSearchUnavailable(`Pixabay answered ${response.status}.`);
  const json = (await response.json().catch(() => null)) as { hits?: unknown[] } | null;
  return (json?.hits ?? [])
    .map(imageFromPixabay)
    .filter((photo): photo is ImageResult => photo !== null && fits(photo, input.orientation))
    .slice(0, input.count);
}

export type ImageLibrary = { name: "Pexels" | "Pixabay"; search: (input: ImageSearchInput) => Promise<ImageResult[]> };

/** The photo library Cencori has a key for, Pexels first; null with neither. */
export function imageLibrary(env: Record<string, string | undefined> = process.env): ImageLibrary | null {
  const pexels = env.PEXELS_API_KEY?.trim();
  if (pexels) return { name: "Pexels", search: (input) => searchPexels(input, pexels) };
  const pixabay = env.PIXABAY_API_KEY?.trim();
  if (pixabay) return { name: "Pixabay", search: (input) => searchPixabay(input, pixabay) };
  return null;
}
