import { NextResponse } from "next/server";
import { getAllPosts, getPostUrl } from "@/lib/blog";

export async function GET() {
  const posts = getAllPosts()
    .slice(0, 3)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      date: post.date,
      coverImage: post.coverImage ?? null,
      url: getPostUrl(post),
    }));
  return NextResponse.json({ posts });
}
