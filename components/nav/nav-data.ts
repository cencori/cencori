export const navigationMenus = [
  {
    id: "products",
    label: "Products",
    eyebrow: "Explore products",
    primary: [
      { href: "/ai-gateway", label: "AI Gateway" },
      { href: "/basecode", label: "Basecode" },
      { href: "/arcie", label: "Arcie" },
    ],
    secondaryLabel: "Build with",
    secondary: [
      { href: "/ai/models", label: "Models" },
      { href: "/memory", label: "Memory" },
      { href: "/arcie", label: "Agent deployment" },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    eyebrow: "The systems beneath intelligence",
    primary: [
      { href: "/ai-gateway", label: "AI Gateway" },
      { href: "/ai/models", label: "Model infrastructure" },
      { href: "/compute", label: "Compute systems" },
      { href: "/edge", label: "Edge infrastructure" },
    ],
    secondaryLabel: "Operating layer",
    secondary: [
      { href: "/security", label: "Security" },
      { href: "/enterprise", label: "Enterprise" },
      { href: "/partners", label: "Partners" },
      { href: "/status", label: "System status" },
    ],
  },
  {
    id: "industries",
    label: "Industries",
    eyebrow: "Intelligence in the real world",
    primary: [
      { href: "/solutions/fintech", label: "Financial systems" },
      { href: "/solutions/healthcare", label: "Healthcare" },
      { href: "/solutions/enterprise", label: "Enterprise" },
      { href: "/solutions/ai-builders", label: "AI builders" },
    ],
    secondaryLabel: "More applications",
    secondary: [
      { href: "/solutions/startups", label: "Startups" },
      { href: "/solutions/agencies", label: "Agencies" },
      { href: "/solutions/no-code", label: "No-code" },
      { href: "/solutions/hackathons", label: "Hackathons" },
    ],
  },
  {
    id: "research",
    label: "Research",
    eyebrow: "Explore the frontier",
    primary: [
      { href: "/manifesto", label: "Thesis" },
      { href: "/blog/engineering", label: "Engineering" },
      { href: "/blog/product", label: "Product research" },
      { href: "/blog", label: "Dispatches" },
    ],
    secondaryLabel: "Follow the work",
    secondary: [
      { href: "/shipped", label: "What we shipped" },
      { href: "/changelog", label: "Changelog" },
      { href: "/security", label: "Security" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    id: "company",
    label: "Company",
    eyebrow: "Inside Cencori",
    primary: [
      { href: "/about", label: "About Us" },
      { href: "#mission", label: "Mission" },
      { href: "/careers", label: "Careers" },
      { href: "/contact", label: "Contact" },
    ],
    secondaryLabel: "From the company",
    secondary: [
      { href: "/partners", label: "Partners" },
      { href: "/customers", label: "Customers" },
      { href: "/press", label: "Press" },
      { href: "/brand", label: "Brand" },
    ],
  },
] as const;

export type NavigationMenuId = (typeof navigationMenus)[number]["id"];
