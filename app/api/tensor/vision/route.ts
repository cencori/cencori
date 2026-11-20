import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { describeImage, IMAGE_DATA_URL } from "@/lib/tensor-vision";

// POST { images: [data URL] }: what each picture shows, for a project chat's message, described
// by the vision model on the person's reserved turn (as a plain chat's pictures are).

const MAX_IMAGES = 8;
const MAX_IMAGE_CHARS = 7_000_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const session = await authenticateTensorDataRequest(authorization);
  if (!session || !authorization) return json({ error: "Your Cencori session is invalid." }, 401);
  const body = (await request.json().catch(() => null)) as { images?: unknown } | null;
  const images = Array.isArray(body?.images) ? body.images.filter((one): one is string => typeof one === "string" && IMAGE_DATA_URL.test(one)) : [];
  if (!images.length) return json({ error: "Send at least one image." }, 400);
  if (images.length > MAX_IMAGES) return json({ error: `At most ${MAX_IMAGES} images at once.` }, 413);
  if (images.some((one) => one.length > MAX_IMAGE_CHARS)) return json({ error: "One of the images is too large." }, 413);
  const origin = new URL(request.url).origin;
  const descriptions = await Promise.all(images.map((url) => describeImage(authorization, origin, url)));
  return json({ descriptions });
}
