import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import vercelConfig from "./vercel.json";

// vercel.json stays the single source for the public /v1/* rewrites and the
// legacy redirects. Vercel applies it itself; anywhere else (`next start` on
// Brimble) Next has to apply it. Host-conditioned rules are skipped because
// proxy.ts already rewrites the pitch/design subdomains, and applying them
// twice would double the path prefix.
const onVercel = Boolean(process.env.VERCEL);
const portableRewrites = onVercel
  ? []
  : vercelConfig.rewrites
      .filter((rule) => !("has" in rule))
      .map(({ source, destination }) => ({ source, destination }));
const portableRedirects = onVercel ? [] : vercelConfig.redirects;

const nextConfig: NextConfig = {
  // Exercise local subdomains with the same host-based routing as production.
  allowedDevOrigins: ["console.localhost", "pitch.localhost", "studio.localhost", "**.sslip.io", "172-20-10-5.sslip.io", "studio.172-20-10-5.sslip.io"],
  // The Vercel build container (8GB) OOMs when Next forks tsc after a
  // 4-minute webpack compile. The tree typechecks clean — verify with
  // `npm run typecheck` locally or in CI instead of during the build.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Vercel functions run linux/x64. onnxruntime-node ships prebuilt binaries
  // for every platform (darwin/win32/arm64 ≈ 130MB) plus a 90MB browser
  // build (onnxruntime-web) that Node never loads — nft traces them into
  // every serverless function and blows the 250MB limit. Exclude the dead
  // weight; the linux/x64 binary stays in case embeddings run in-function.
  outputFileTracingExcludes: {
    '*': [
      './node_modules/onnxruntime-node/bin/napi-v3/darwin/**/*',
      './node_modules/onnxruntime-node/bin/napi-v3/win32/**/*',
      './node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**/*',
      './node_modules/onnxruntime-web/**/*',
      './node_modules/@huggingface/transformers/**/*',
      './node_modules/onnxruntime-common/**/*',
      './node_modules/onnxruntime-node/dist/**/*',
      './node_modules/sharp/**/*',
      './node_modules/@img/sharp-*/**/*',
    ],
  },
  // The invoice PDF reads its fonts and logo from disk at runtime.
  outputFileTracingIncludes: {
    '/api/billing/invoices/**': ['./lib/billing/invoice-assets/**/*'],
    // Copilot searches the docs to answer product questions.
    '/api/agent': ['./content/docs/**/*'],
  },
  // Transformers.js includes native ONNX binaries and runtime model loading.
  // Keep it out of Turbopack's module graph; API routes load it in Node only.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "ioredis"],
  experimental: {
    // @lobehub/icons is imported from its barrel, which pulls in every brand
    // icon plus antd and @lobehub/ui; loading only the icons we use keeps the
    // webpack build small enough for the build machine's memory.
    optimizePackageImports: ["lucide-react", "@lobehub/icons"],
    // Lower peak memory during the webpack compile (Vercel builds were OOMing
    // on the 16GB machine with webpack; Turbopack is the build now).
    webpackMemoryOptimizations: true,
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },
  async rewrites() {
    return {
      // Like vercel.json rewrites, these run before filesystem routes.
      beforeFiles: portableRewrites,
      afterFiles: [
        // Legacy desktop API prefix. Rewritten (not redirected) so POST bodies
        // survive: old builds calling /api/basecode/* reach the same handlers
        // as /api/tensor/*.
        { source: "/api/basecode/:path*", destination: "/api/tensor/:path*" },
        // Serve the docs landing page directly so social crawlers receive the
        // introduction metadata without needing to follow a redirect.
        { source: "/docs", destination: "/docs/introduction" },
        // Most agents probe /llms.txt (llmstxt.org convention); our file lives at
        // /llm.txt. Serve the same content at /llms.txt with a 200 (a rewrite, not
        // a redirect, so fetchers that don't follow 3xx still get the guide).
        { source: "/llms.txt", destination: "/llm.txt" },
        // An agent's shareable link (the full-page widget chat).
        { source: "/talk/:token", destination: "/api/widget/share/:token" },
        // "View as Markdown" and agents fetch `<docs page>.md`. Rewrites run
        // before dynamic routes, so these win over app/docs/[[...slug]].
        { source: "/docs/:path+.md", destination: "/api/docs/markdown/:path+" },
        { source: "/arcie/docs.md", destination: "/api/arcie/docs/markdown" },
        { source: "/arcie/docs/:path+.md", destination: "/api/arcie/docs/markdown/:path+" },
      ],
      fallback: [],
    };
  },
  async redirects() {
    return [
      ...portableRedirects,
      {
        source: "/blog/computing-infrastructure-global-ai-runs-on",
        destination: "/thesis",
        permanent: true,
      },
      // Blog hub moved to /newsroom.
      {
        source: "/blog",
        destination: "/newsroom",
        permanent: true,
      },
      {
        source: "/blog/:path*",
        destination: "/newsroom/:path*",
        permanent: true,
      },
      // Press coverage lives in the newsroom hub (Press tab) now.
      {
        source: "/press",
        destination: "/newsroom",
        permanent: true,
      },
      // Model catalog lives on one surface now.
      {
        source: "/models",
        destination: "/ai-gateway/models",
        permanent: true,
      },
      // Basecode → Tensor product rename. Old desktop builds and bookmarks
      // still hit /basecode/*; send them to the matching /tensor/* route
      // (query strings, including the sign-in params, are preserved).
      {
        source: "/basecode/:path*",
        destination: "/tensor/:path*",
        permanent: true,
      },
      {
        source: "/ai/models",
        destination: "/ai-gateway/models",
        permanent: true,
      },
      // Gateway security is now opt-in PII protection only (2026-10-24):
      // content filtering, prompt-injection checks, the incidents page, and
      // governance were retired.
      ...[
        "content-filtering",
        "prompt-injection",
        "incidents",
      ].map((slug) => ({
        source: `/docs/security/${slug}`,
        destination: "/docs/security/pii-detection",
        permanent: true,
      })),
      {
        source: "/docs/security/governance",
        destination: "/docs/platform/audit-logs",
        permanent: true,
      },
      {
        source: "/docs/platform/ai-gateway/semantic-caching",
        destination: "/docs/platform/ai-gateway/caching",
        permanent: true,
      },
      // Custom providers retired from the dashboard (2026-10-24).
      ...[
        "/docs/platform/ai-gateway/custom-providers",
        "/docs/guides/custom-providers",
        "/docs/api/custom-providers",
      ].map((source) => ({ source, destination: "/docs/platform/byok", permanent: true })),
    ];
  },
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
        // Apply security headers to ALL routes except the website widget
        // frame, which is built to be framed: its route sends its own
        // frame-ancestors allowlist instead of X-Frame-Options: DENY.
        source: "/:path((?!api/widget/frame/).*)",
        headers: securityHeaders,
      },
      {
        source: "/api/widget/frame/:path*",
        headers: securityHeaders.filter((header) => header.key !== "X-Frame-Options"),
      },
      {
        // The widget scripts change with releases; keep caches short.
        source: "/(widget|widget-frame).js",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "public, max-age=300" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
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
      {
        // Uploaded files (app/api/files) also end in .jpg/.webp, but they are
        // looked up per request; the rule above would pin even a 404 for a year.
        source: "/api/files/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
