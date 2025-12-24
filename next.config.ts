import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure images to allow /api/og with query strings
  images: {
    localPatterns: [
      {
        pathname: "/api/og",
        search: "",
      },
    ],
  },
  // Aggressive caching for static assets (OG images, etc.)
  async headers() {
    return [
      {
        // Cache OG image for 1 year (immutable since we version via filename)
        source: "/og-image.(jpg|png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache all static images for 1 year
        source: "/:all*.(jpg|jpeg|png|gif|webp|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
