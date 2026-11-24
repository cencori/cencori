export const STORY_PRODUCTS = ["API", "Tensor", "Arcie"] as const;
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
    slug: "dayroom",
    company: "Dayroom",
    title: "A team chat that turns into finished work",
    excerpt:
      "How Dayroom, the AI-native workspace for small teams, builds its companion and agents on Cencori.",
    industry: "Collaboration",
    useCase: "AI agents",
    product: "API",
    publishedAt: "2026-11-23",
    cover: "/stories/dayroom.jpg",
    body: [
      "Dayroom is an AI-native workspace for teams of 2 to 20 that run their work in chat: agencies, studios and startups. Rooms, calls, tasks and docs live together, and an AI companion keeps everyone in the loop. It answers what you missed with sources, posts notes after calls and drafts replies and to-dos that wait for your approval.",
      "The team builds those agents on Cencori. A companion that people lean on for their day-to-day work has to understand context and get the task right.",
      "Through Cencori, the team connects different AI models to Dayroom from one place, tries them against each other and picks by what each does best. “Cencori has been a really great product for me to use, especially building agents right here on Dayroom,” says Dayroom's founder.",
      "What matters most to him is accuracy on real work. “We hardly get any periods where these models hallucinate, especially when they're performing tasks that actually help the day-to-day workflows of users,” he says. “That's something I really love, and it's been a sticky experience for me.”",
      "He now points other builders to it. “I always recommend it to my friends because of how seamless it is to get a plethora of AI models, use them and test them out based on their capabilities.”",
    ],
    quote: {
      text: "It's been very seamless to connect different AI models and plug them into Dayroom. The Dayroom companion has been very intelligent, and it understands a lot of context.",
      by: "Founder, Dayroom",
    },
  },
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
