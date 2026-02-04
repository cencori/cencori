import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure images to allow all local paths (Next.js 16 requirement)
  images: {
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
  },
  // Security and caching headers
  async headers() {
    // Security headers to apply to all routes
    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    return [
      {
        // Apply security headers to ALL routes
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Cache OG image for 1 year (immutable since we version via filename)
        source: "/og-image.(jpg|png)",
        headers: [
          ...securityHeaders,
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
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  // Rewrite api.cencori.com/* to /api/*
  async rewrites() {
    return {
      beforeFiles: [
        // api.cencori.com/v1/* → /api/v1/*
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'api.cencori.com' }],
          destination: '/api/:path*',
        },
      ],
    };
  },
};

export default nextConfig;
