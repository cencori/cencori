import { readFile } from "node:fs/promises";
import path from "node:path";

import { getAllPosts } from "@/lib/blog";

export const BACKGROUND_COUNT = 5;

export function getFallbackPosts() {
  return getAllPosts()
    .filter((post) => post.published && !post.coverImage)
    .sort((a, b) => {
      const dateDifference =
        new Date(a.date).getTime() - new Date(b.date).getTime();

      return dateDifference || a.slug.localeCompare(b.slug);
    });
}

export function getBackgroundNumber(slug: string) {
  const postIndex = getFallbackPosts().findIndex((post) => post.slug === slug);

  return (Math.max(postIndex, 0) % BACKGROUND_COUNT) + 1;
}

function sliceBuffer(file: Buffer): ArrayBuffer {
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
}

export async function loadBackground(number: number): Promise<ArrayBuffer> {
  const padded = String(number).padStart(2, "0");
  const file = await readFile(
    path.join(
      process.cwd(),
      "public",
      "newsroom",
      "og",
      "backgrounds",
      `${padded}.jpg`,
    ),
  );
  return sliceBuffer(file);
}

export interface OgFonts {
  manropeFont: ArrayBuffer;
  geistFont: ArrayBuffer;
}

export async function loadFonts(): Promise<OgFonts> {
  const [manropeFile, geistFile] = await Promise.all([
    readFile(
      path.join(process.cwd(), "public", "fonts", "manrope-medium.ttf"),
    ),
    readFile(path.join(process.cwd(), "app", "Geist-Black.ttf")),
  ]);
  return { manropeFont: sliceBuffer(manropeFile), geistFont: sliceBuffer(geistFile) };
}

export function CencoriMark() {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 100 100"
      fill="none"
    >
      <g clipPath="url(#newsroom-og-mark-clip)">
        <circle cx="35.3" cy="0" r="35.3" fill="#fff" />
        <circle cx="0" cy="64.7" r="35.3" fill="#fff" />
        <circle cx="100" cy="35.3" r="35.3" fill="#fff" />
        <circle cx="64.7" cy="100" r="35.3" fill="#fff" />
      </g>
      <defs>
        <clipPath id="newsroom-og-mark-clip">
          <rect width="100" height="100" rx="3" fill="#fff" />
        </clipPath>
      </defs>
    </svg>
  );
}
