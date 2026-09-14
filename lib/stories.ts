export const STORY_PRODUCTS = ["API", "Basecode", "Arcie"] as const;
export type StoryProduct = (typeof STORY_PRODUCTS)[number];

export type Story = {
  slug: string;
  company: string;
  title: string;
  excerpt: string;
  industry: string;
  useCase: string;
  product: StoryProduct;
  publishedAt: string;
  cover: string;
  body: string[];
  inlineImage?: { src: string; alt: string };
  belowImage?: string[];
  quote?: { text: string; by: string };
  featured?: boolean;
};

export const stories: Story[] = [
  {
    slug: "eleven",
    company: "Eleven",
    title: "Cinema-grade stories, computed in the cloud",
    excerpt:
      "How Eleven renders cinematic AI experiences on Cencori — heavy creative workloads, one API.",
    industry: "Media",
    useCase: "Creative AI",
    product: "API",
    publishedAt: "2026-09-12",
    cover: "/stories/el.JPG",
    body: [
      "Eleven works where film meets machine intelligence — crafting cinematic experiences that demand serious compute behind every frame.",
      "Running on Cencori's API, the studio scales creative workloads up and down without managing infrastructure.",
    ],
  },
  {
    slug: "spitch",
    company: "Spitch",
    title: "Voice AI through a single API",
    excerpt:
      "How Spitch ships realtime speech experiences on Cencori's API — one integration for models, billing, and scale.",
    industry: "Voice AI",
    useCase: "Media",
    product: "API",
    publishedAt: "2026-09-10",
    cover: "/stories/stch.JPG",
    body: [
      "Spitch is building realtime voice experiences — the kind where every millisecond matters and every call has to just work.",
      "Barely days after announcing, the team was already handling serious production volume through a single Cencori integration.",
    ],
    quote: {
      text: "Barely 4 days since we announced and we've handled thousands of voice requests, and hundreds of calls.",
      by: "Temi Babs, CEO Spitch",
    },
  },
  {
    slug: "ypit",
    company: "YPIT",
    title: "Young People In Tech, building live",
    excerpt:
      "How YPIT runs hackathons and programs where young builders ship real AI products on Cencori.",
    industry: "Community",
    useCase: "Hackathons",
    product: "API",
    publishedAt: "2026-09-05",
    cover: "/stories/pit.JPG",
    body: [
      "Young People In Tech runs hackathons and programs where young builders go from idea to working product in days.",
      "Running on Cencori's API, teams ship real AI products — same foundation, from first prototype to production.",
    ],
    belowImage: [
      "Our CEO, Bola Banjo, also joined their workshop sessions with “Exploring Agents: How to build them safely — from infrastructure to impact”: what makes agents powerful, what makes them risky, and how Cencori's infrastructure lets builders create safe, scalable agents without reinventing the wheel. Session held Thursday, May 21st.",
    ],
    inlineImage: {
      src: "/stories/tech-event-1-768x512.webp",
      alt: "YPIT workshop session group photo",
    },
  },
];

export function getStories(): Story[] {
  return stories;
}

export function getStoryFacets(stories: Story[]) {
  const industries = [...new Set(stories.map((s) => s.industry))].sort();
  const useCases = [...new Set(stories.map((s) => s.useCase))].sort();
  return { industries, useCases };
}
