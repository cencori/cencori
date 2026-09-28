import { getPostBySlug } from "@/lib/blog";
import {
  createBareImageResponse,
  getBackgroundNumber,
  getFallbackPosts,
  loadBackground,
} from "../../og-shared";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

const size = {
  width: 1080,
  height: 1080,
};

export function generateStaticParams() {
  return getFallbackPosts().map((post) => ({ slug: `${post.slug}.jpg` }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: imageSlug } = await params;

  if (!imageSlug.endsWith(".jpg")) {
    return new Response(null, { status: 404 });
  }

  const postSlug = imageSlug.slice(0, -".jpg".length);
  const post = getPostBySlug(postSlug);

  if (!post || !post.published || post.coverImage) {
    return new Response(null, { status: 404 });
  }

  const image = await loadBackground(getBackgroundNumber(postSlug));

  return createBareImageResponse(image, size);
}
