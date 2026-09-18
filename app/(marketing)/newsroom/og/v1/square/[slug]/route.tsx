import { ImageResponse } from "next/og";
import sharp from "sharp";

import { getPostBySlug } from "@/lib/blog";
import {
  CencoriMark,
  getBackgroundNumber,
  getFallbackPosts,
  loadBackground,
  loadFonts,
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
  return getFallbackPosts().map((post) => ({
    slug: `${post.slug}.jpg`,
  }));
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

  if (
    !post ||
    !post.published ||
    post.coverImage
  ) {
    return new Response(null, { status: 404 });
  }

  const title = post.title.slice(0, 120);
  const titleFontSize =
    title.length > 90
      ? 44
      : title.length > 70
        ? 50
        : title.length > 50
          ? 56
          : 64;
  const category = post.category
    ? post.category.charAt(0).toUpperCase() + post.category.slice(1)
    : "Newsroom";
  const date = new Date(post.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const backgroundNumber = getBackgroundNumber(postSlug);

  const [backgroundImage, { manropeFont, geistFont }] = await Promise.all([
    loadBackground(backgroundNumber),
    loadFonts(),
  ]);

  const pngResponse = new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "#050505",
          color: "#ffffff",
        }}
      >
        {/* next/image is not supported inside ImageResponse. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={backgroundImage as unknown as string}
          width="1080"
          height="1080"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.58) 52%, rgba(0, 0, 0, 0.12) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(0deg, rgba(0, 0, 0, 0.76) 0%, rgba(0, 0, 0, 0) 64%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 72,
            left: 84,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <CencoriMark />
          <div
            style={{
              display: "flex",
              width: 1,
              height: 24,
              background: "rgba(255, 255, 255, 0.45)",
            }}
          />
          <div
            style={{
              display: "flex",
              fontFamily: "Manrope, sans-serif",
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: "-0.7px",
            }}
          >
            Cencori
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 84,
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 912,
          }}
        >
          <div
            style={{
              display: "flex",
              marginBottom: 22,
              fontFamily: "Manrope, sans-serif",
              fontSize: 19,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: "2.4px",
              textTransform: "uppercase",
              color: "rgba(255, 255, 255, 0.68)",
            }}
          >
            {category} · {date}
          </div>
          <div
            style={{
              display: "flex",
              width: "100%",
              fontFamily: "Geist, sans-serif",
              fontSize: titleFontSize,
              fontWeight: 900,
              lineHeight: 1.04,
              letterSpacing: "-2.8px",
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Manrope",
          data: manropeFont,
          style: "normal",
          weight: 500,
        },
        {
          name: "Geist",
          data: geistFont,
          style: "normal",
          weight: 900,
        },
      ],
    },
  );
  const png = Buffer.from(await pngResponse.arrayBuffer());
  const jpeg = await sharp(png)
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
