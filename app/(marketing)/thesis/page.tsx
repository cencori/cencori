import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";

import { parseMDX, type BlogPost } from "@/lib/blog";
import { PostView } from "@/components/blog/PostView";

const THESIS_PATH = path.join(process.cwd(), "content", "thesis.mdx");

function getThesisPost(): BlogPost {
  const raw = fs.readFileSync(THESIS_PATH, "utf-8");
  const { data, content } = matter(raw);
  const stats = readingTime(content);

  return {
    title: (data.title as string) ?? "Thesis",
    slug: "thesis",
    date: (data.date as string) ?? "2026-08-16",
    excerpt: (data.excerpt as string) ?? "",
    coverImage: (data.coverImage as string) ?? "",
    authors: [],
    tags: (data.tags as string[]) ?? [],
    category: "community",
    published: true,
    content,
    readTime: stats.text,
    authorDetails: [],
  };
}

export const metadata: Metadata = {
  title: "Thesis — The Computing Infrastructure AI Runs On",
  description:
    "AI began as something people accessed. It is becoming something the world operates. Our thesis on why the infrastructure beneath intelligence has to expand with it — and why our mission is to make it accessible to everyone, everywhere.",
  alternates: {
    canonical: "https://cencori.com/thesis",
  },
  openGraph: {
    title: "Thesis — The Computing Infrastructure AI Runs On",
    description:
      "AI began as something people accessed. It is becoming something the world operates. Our thesis on why the infrastructure beneath intelligence has to expand with it.",
    url: "https://cencori.com/thesis",
    siteName: "Cencori",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thesis — The Computing Infrastructure AI Runs On",
    description:
      "AI began as something people accessed. It is becoming something the world operates.",
  },
};

export default async function ThesisPage() {
  const post = getThesisPost();
  const content = await parseMDX(post.content);

  return (
    <PostView
      post={post}
      content={content}
      toc={[]}
      showShare={false}
      showCopyMarkdown={false}
      centerHeader
      narrow
      bottomGap
      contentClassName="text-[17px] leading-[1.8] text-white [&_p]:text-white [&_p]:text-[17px] [&_p]:leading-[1.8] [&_li]:text-white [&_li]:text-[17px] [&_ul]:text-[17px] [&_ol]:text-[17px] [&_h1]:text-white [&_h1]:text-[34px] [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:text-white [&_h2]:text-[28px] [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:leading-[1.2] [&_h2]:mt-14 [&_h3]:text-white [&_h3]:text-[22px] [&_h3]:font-bold [&_h3]:tracking-tight [&_h3]:leading-[1.3] [&_h3]:mt-10 [&_h4]:text-white [&_h4]:text-[19px] [&_h4]:font-bold [&_blockquote]:text-white/90 [&_th]:text-white [&_td]:text-white/90 [&_strong]:text-white"
      breadcrumb={
        <span className="text-primary font-medium">Thesis</span>
      }
      prevPost={null}
      nextPost={null}
    />
  );
}
