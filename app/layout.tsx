// app/layout.tsx
import { Montserrat, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/CookieConsent";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/sonner";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"]
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

// Aggressive keyword targeting
const keywords = [
  // Primary brand
  "Cencori",
  "cencori",

  // Core product keywords
  "AI infrastructure",
  "AI infrastructure platform",
  "AI gateway",
  "LLM gateway",
  "AI API gateway",
  "unified AI API",

  // Security keywords (high value)
  "AI security",
  "LLM security",
  "AI firewall",
  "prompt injection protection",
  "AI threat detection",
  "secure AI deployment",
  "AI data protection",
  "enterprise AI security",

  // Observability keywords
  "AI observability",
  "LLM observability",
  "AI monitoring",
  "LLM monitoring",
  "AI analytics",
  "AI request logging",
  "AI cost tracking",

  // Multi-model / provider keywords
  "multi-model AI",
  "AI provider management",
  "OpenAI alternative",
  "Anthropic API",
  "Claude API",
  "GPT API",
  "AI model routing",
  "AI load balancing",
  "AI failover",

  // Developer-focused
  "AI SDK",
  "AI developer tools",
  "AI integration",
  "AI orchestration",
  "production AI",
  "AI for developers",

  // Enterprise keywords
  "enterprise AI",
  "AI compliance",
  "AI governance",
  "AI audit",
  "AI cost control",
  "AI cost optimization",

  // Competitor alternatives (aggressive)
  "Portkey alternative",
  "Helicone alternative",
  "LangSmith alternative",
  "AI gateway comparison",
];

export const metadata: Metadata = {
  metadataBase: new URL('https://cencori.com'),
  title: {
    default: "Cencori | The Infrastructure for AI Production.",
    template: "%s - Cencori",
  },
  description: "Cencori is the infrastructure for AI production. Ship AI with built-in security, observability, and scale — all in one platform.",
  keywords: keywords,
  authors: [{ name: "Cencori" }],
  creator: "Cencori",
  publisher: "Cencori",

  // Open Graph for social sharing
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cencori.com",
    siteName: "Cencori",
    title: "Cencori | The Infrastructure for AI Production",
    description: "Ship AI with built-in security, observability, and scale — all in one platform.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Cencori — The Infrastructure for AI Production",
      },
    ],
  },

  // Twitter/X Card
  twitter: {
    card: "summary_large_image",
    site: "@cencori",
    creator: "@cencori",
    title: "Cencori | The Infrastructure for AI Production",
    description: "Ship AI with built-in security, observability, and scale — all in one platform.",
    images: ["/og.png"],
  },

  // Canonical and alternates
  alternates: {
    canonical: "https://cencori.com",
  },

  // Search engine directives
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // App-related
  applicationName: "Cencori",
  category: "Technology",

  // Verification (add your actual verification codes)
  // verification: {
  //   google: "your-google-verification-code",
  //   yandex: "your-yandex-verification-code",
  //   bing: "your-bing-verification-code",
  // },
};

// JSON-LD Structured Data
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Cencori",
  "url": "https://cencori.com",
  "logo": "https://cencori.com/clight.png",
  "description": "Cencori is the infrastructure for AI production. Ship AI with built-in security, observability, and scale — all in one platform.",
  "sameAs": [
    "https://x.com/cencori",
    "https://github.com/cencori",
    // Add LinkedIn when available
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "url": "https://cencori.com/contact"
  }
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Cencori",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Cloud",
  "description": "The infrastructure for AI production. Ship AI with built-in security, observability, and scale — all in one platform.",
  "url": "https://cencori.com",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free tier available"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "5",
    "ratingCount": "1"
  }
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Cencori",
  "url": "https://cencori.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://cencori.com/docs?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
      </head>
      <body suppressHydrationWarning className={`${montserrat.variable} ${jetbrainsMono.variable} font-sans`}>
        <ThemeProvider>
          {/* Include the Navbar here */}
          {children}
          <CookieConsent />
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}