export const siteConfig = {
  name: "cencori",
  url: "https://cencori.com",
  description:
    "Cencori is the infrastructure for AI production. Security, observability, and scale — all in one platform.",
  links: {
    github: "https://github.com/cencori",
    docs: "https://cencori.com/docs",
    getStartedUrl: "/signup",
    signInUrl: "/login",
    x: "https://x.com/cencori",
    products: {
      aiGateway: "/ai-gateway",
      audit: "/audit",
      knight: "/knight",
      sandbox: "/psandbox",
      insights: "/insights",
      network: "/network",
      edge: "/edge",
      enterprise: "/product-enterprise",
      developerTools: "/product-developer-tools",
    },
    company: {
      about: "/about",
      blog: "/blog",
      careers: "/careers",
      changelog: "/changelog",
      contact: "/contact",
      customers: "/customers",
      events: "/events",
      examples: "/examples",
      partners: "/partners",
      shipped: "/shipped",
      privacyPolicy: "/privacy-policy",
    },
  },
};

export type SiteConfig = typeof siteConfig;
