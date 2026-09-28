import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

export async function loadPublicImage(
  publicPath: string | undefined,
): Promise<ArrayBuffer | null> {
  if (!publicPath?.startsWith("/")) return null;

  const publicRoot = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicRoot, publicPath.slice(1));

  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) return null;

  try {
    return sliceBuffer(await readFile(filePath));
  } catch {
    return null;
  }
}

export async function createBareImageResponse(
  image: ArrayBuffer,
  size: { width: number; height: number },
): Promise<Response> {
  const jpeg = await sharp(Buffer.from(image))
    .resize(size.width, size.height, { fit: "cover", position: "centre" })
    .flatten({ background: "#050505" })
    .jpeg({
      quality: 82,
      progressive: true,
      chromaSubsampling: "4:2:0",
      mozjpeg: true,
    })
    .toBuffer();
  const body = new ArrayBuffer(jpeg.byteLength);
  new Uint8Array(body).set(jpeg);

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(jpeg.byteLength),
      "Content-Type": "image/jpeg",
      "Vercel-CDN-Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
