export const siteConfig = {
  name: "cencori",
  url: "https://cencori.com",
  description:
    "Cencori is the unified AI infrastructure for production applications. One API for every provider with built-in security, observability, and cost control.",
  links: {
    github: "https://github.com/cencori",
    docs: "https://cencori.com/docs",
    getStartedUrl: "/signup",
    signInUrl: "/login",
    x: "https://x.com/cencori",
    products: {
      ai: "/ai",
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
      partners: "/partners",
      shipped: "/shipped",
      privacyPolicy: "/privacy-policy",
    },
  },
};

export type SiteConfig = typeof siteConfig;
