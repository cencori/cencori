import { NextRequest, NextResponse } from "next/server";
import { checkCustomRateLimit } from "@/lib/rate-limit";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorInferenceRequest } from "@/lib/tensor-cloud-tasks";
import { ImageSearchUnavailable, readImageSearch, searchPexels } from "@/lib/tensor-images";

/**
 * Photo search for Tensor's agent (lib/tensor-images.ts): a signed-in desktop, or a cloud task's
 * sandbox acting for its owner, asks; Cencori asks Pexels with its own key.
 *
 * Pexels gives one key 200 searches an hour, shared by everyone, so each person gets a few a
 * minute and a ceiling a day: enough to pick photos for any page, not enough for one task to
 * use up everyone's hour.
 */
const PER_MINUTE = 10;
const PER_DAY = 150;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function POST(req: NextRequest) {
  const session = await authenticateTensorInferenceRequest(req.headers.get("authorization"));
  if (!session) return json({ error: "Sign in to Tensor to continue.", code: "unauthenticated" }, 401);

  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) {
    console.error("[TensorImages] PEXELS_API_KEY is not configured");
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
    const images = await searchPexels(input, apiKey);
    return json({ query: input.query, page: input.page, images, source: "Pexels" });
  } catch (error) {
    if (error instanceof ImageSearchUnavailable) {
      console.warn(`[TensorImages] ${error.message}`);
      return json({ error: "Photo search isn't available right now. Try again later.", code: "images_unavailable" }, 503);
    }
    throw error;
  }
}
