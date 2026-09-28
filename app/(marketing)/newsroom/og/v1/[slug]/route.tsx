import { getAllPosts, getPostBySlug } from "@/lib/blog";
import {
  createBareImageResponse,
  getBackgroundNumber,
  loadBackground,
  loadPublicImage,
} from "../og-shared";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

const size = {
  width: 1200,
  height: 630,
};

export function generateStaticParams() {
  return getAllPosts()
    .filter((post) => post.published && post.category !== "changelog")
    .map((post) => ({ slug: `${post.slug}.jpg` }));
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

  if (!post || !post.published || post.category === "changelog") {
    return new Response(null, { status: 404 });
  }

  const coverImage = await loadPublicImage(post.coverImage);
  const image = coverImage ?? await loadBackground(getBackgroundNumber(postSlug));

  return createBareImageResponse(image, size);
}
