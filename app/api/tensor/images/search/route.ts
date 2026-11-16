import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkCustomRateLimit } from "@/lib/rate-limit";
import { createRedisClient, type RedisClient } from "@/lib/redis";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorInferenceRequest } from "@/lib/tensor-cloud-tasks";
import { imageLibrary, ImageSearchUnavailable, readImageSearch, type ImageResult, type ImageSearchInput } from "@/lib/tensor-images";

/**
 * Photo search for Tensor's agent (lib/tensor-images.ts): a signed-in desktop, or a cloud task's
 * sandbox acting for its owner, asks; Cencori asks the photo library with its own key.
 *
 * A library's key is shared by everyone (Pexels: 200 searches an hour; Pixabay: 100 a minute), so
 * each person gets a few a minute and a ceiling a day, and the same search is answered from a day's
 * cache, as Pixabay asks.
 */
const PER_MINUTE = 10;
const PER_DAY = 150;
const CACHE_SECONDS = 24 * 60 * 60;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

let redis: RedisClient | null | undefined;

function cache(): RedisClient | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    redis = url && token ? createRedisClient({ url, token }) : null;
  } catch {
    redis = null;
  }
  return redis;
}

function cacheKey(library: string, input: ImageSearchInput): string {
  const shape = JSON.stringify([input.query.toLowerCase(), input.orientation ?? "", input.count, input.page]);
  return `tensor_images:cache:${library}:${createHash("sha256").update(shape).digest("hex").slice(0, 32)}`;
}

/** A search's photos: from the day's cache, or from the library (and then cached). */
async function search(library: NonNullable<ReturnType<typeof imageLibrary>>, input: ImageSearchInput) {
  const client = cache();
  const key = cacheKey(library.name, input);
  const cached = client ? await client.get<ImageResult[]>(key).catch(() => null) : null;
  if (Array.isArray(cached)) return cached;
  const images = await library.search(input);
  if (client) void client.set(key, images, { ex: CACHE_SECONDS }).catch(() => {});
  return images;
}

export async function POST(req: NextRequest) {
  const session = await authenticateTensorInferenceRequest(req.headers.get("authorization"));
  if (!session) return json({ error: "Sign in to Tensor to continue.", code: "unauthenticated" }, 401);

  const library = imageLibrary();
  if (!library) {
    console.error("[TensorImages] Neither PEXELS_API_KEY nor PIXABAY_API_KEY is configured");
    return json({ error: "Photo search isn't available right now.", code: "images_unconfigured" }, 503);
  }

  const input = readImageSearch(await req.json().catch(() => null));
  if ("error" in input) return json({ error: input.error, code: "invalid_request" }, 400);

  const userId = session.user.id;
  const minute = await checkCustomRateLimit(`tensor_images:minute:${userId}`, PER_MINUTE, 60);
  if (!minute.allowed) {
    return json({ error: "Too many photo searches this minute. Use the results you have, or wait a moment.", code: "rate_limited" }, 429);
  }
  const day = await checkCustomRateLimit(`tensor_images:day:${userId}`, PER_DAY, 24 * 60 * 60);
  if (!day.allowed) {
    return json({ error: "That's today's photo searches used. Use the photos already found.", code: "rate_limited" }, 429);
  }

  try {
    const images = await search(library, input);
    return json({ query: input.query, page: input.page, images, source: library.name });
  } catch (error) {
    if (error instanceof ImageSearchUnavailable) {
      console.warn(`[TensorImages] ${error.message}`);
      return json({ error: "Photo search isn't available right now. Try again later.", code: "images_unavailable" }, 503);
    }
    throw error;
  }
}
