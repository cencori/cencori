export const STORY_PRODUCTS = ["API", "Tensor", "Arcie"] as const;
export type StoryProduct = (typeof STORY_PRODUCTS)[number];

/**
 * A customer is a company building on Cencori, told as a case study at
 * /customers/[slug]. A story is about people and the ecosystem, at
 * /stories/[slug]. Each piece has exactly one address.
 */
export type StoryKind = "customer" | "story";

export type Story = {
  kind: StoryKind;
  slug: string;
  company: string;
  title: string;
  excerpt: string;
  industry: string;
  useCase: string;
  product: StoryProduct;
  /** Customers: the parts of Cencori they use, shown as "Built on". Defaults to `product`. */
  uses?: string[];
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
    kind: "customer",
    slug: "vbox",
    company: "Vbox",
    title: "How Vbox uses the Cencori API and SDKs to cut its AI bill by 75%",
    excerpt:
      "How Vbox, a speech AI company, cut its monthly AI bill from about $800 to about $200 on Cencori, and pays for it in naira.",
    industry: "Voice AI",
    useCase: "Conversational AI",
    product: "API",
    uses: ["Developer platform", "API", "SDKs"],
    publishedAt: "2026-11-28",
    cover: "/stories/vbox-mark.jpg",
    body: [
      "Vbox is a speech AI company that builds conversational technology: products where a person talks, and the system has to understand and answer in real time.",
      "The team builds on Cencori's developer platform every day, using the API and SDKs for the models behind their conversations, with usage, costs and keys in one place.",
      "Within a month of moving to Cencori, Vbox's AI bill fell from about $800 a month to about $200, a quarter of what it was.",
      "Paying in naira made it better still. Vbox pays for Cencori in its own currency.",
    ],
  },
  {
    kind: "customer",
    slug: "dayroom",
    company: "Dayroom",
    title: "How Dayroom uses the Cencori API to build an AI companion for team chat",
    excerpt:
      "How Dayroom, the AI-native workspace for small teams, builds its companion and agents on Cencori.",
    industry: "Collaboration",
    useCase: "AI agents",
    product: "API",
    uses: ["API"],
    publishedAt: "2026-11-23",
    cover: "/stories/dayroom-braille.jpg",
    body: [
      "Dayroom is an AI-native workspace for teams of 2 to 20 that run their work in chat: agencies, studios and startups. Rooms, calls, tasks and docs live together, and an AI companion keeps everyone in the loop. It answers what you missed with sources, posts notes after calls and drafts replies and to-dos that wait for your approval.",
      "The team builds those agents on Cencori. A companion that people lean on for their day-to-day work has to understand context and get the task right.",
      "Through Cencori, the team connects different AI models to Dayroom from one place, tries them against each other and picks by what each does best. “Cencori has been a really great product for me to use, especially building agents right here on Dayroom,” says Fikayo Adeleke, Dayroom's founder.",
      "What matters most to Adeleke is accuracy on real work. “We hardly get any periods where these models hallucinate, especially when they're performing tasks that actually help the day-to-day workflows of users,” he says. “That's something I really love, and it's been a sticky experience for me.”",
      "He now points other builders to it. “I always recommend it to my friends because of how seamless it is to get a plethora of AI models, use them and test them out based on their capabilities.”",
    ],
    quote: {
      text: "It's been very seamless to connect different AI models and plug them into Dayroom. The Dayroom companion has been very intelligent, and it understands a lot of context.",
      by: "Fikayo Adeleke, Founder, Dayroom",
    },
  },
  {
    kind: "customer",
    slug: "eleven",
    company: "Eleven",
    title: "How Eleven uses the Cencori API to render cinematic AI at scale",
    excerpt:
      "How Eleven renders cinematic AI experiences on Cencori — heavy creative workloads, one API.",
    industry: "Media",
    useCase: "Creative AI",
    product: "API",
    uses: ["API"],
    publishedAt: "2026-09-12",
    cover: "/stories/eleven-metal.jpg",
    body: [
      "Eleven works where film meets machine intelligence — crafting cinematic experiences that demand serious compute behind every frame.",
      "Running on Cencori's API, the studio scales creative workloads up and down without managing infrastructure.",
    ],
  },
  {
    kind: "story",
    slug: "ifeoluwa-adebanjo",
    company: "Ifeoluwa Adebanjo",
    title: "From runner-up to first place, starting with the right question",
    excerpt:
      "How Ifeoluwa Adebanjo, a computer engineering student, wrote her APWEN-LASU Career Summit talk with Tensor and took first place.",
    industry: "Education",
    useCase: "Writing",
    product: "Tensor",
    publishedAt: "2026-11-23",
    cover: "/stories/ifeoluwa-bloom.jpg",
    body: [
      "Ifeoluwa Adebanjo, a computer engineering student, had a talk to give, and asked Tensor to help her write it.",
      "Tensor's draft opened with a question to the room: “How many of you know the gap between a syllabus and a job description?” It was exactly where she meant to start. “Tensor is smart because this is exactly the first thing I was going to ask too,” she says.",
      "She tried the same request somewhere else and got a list of questions back before any writing: how long the slot was, what to cover, which field. “Not bad, but it wasn't what I was looking for.”",
      "Tensor had already done that work, and she had the talk. Her verdict, posted to her status: “Tensor asks the right questions. Use Tensor!”",
      "She gave it at the APWEN-LASU Career Summit and took first place, a year after finishing first runner-up.",
    ],
    quote: {
      text: "Tensor asks the right questions.",
      by: "Ifeoluwa Adebanjo, Computer Engineering student",
    },
  },
  {
    kind: "story",
    slug: "spitch",
    company: "Spitch",
    title: "Voice AI through a single API",
    excerpt:
      "How Spitch ships realtime speech experiences on Cencori's API — one integration for models, billing, and scale.",
    industry: "Voice AI",
    useCase: "Media",
    product: "API",
    publishedAt: "2026-09-10",
    cover: "/stories/spitch-mountain.jpg",
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
    kind: "story",
    slug: "ypit",
    company: "YPIT",
    title: "Young People In Tech, building live",
    excerpt:
      "How YPIT runs hackathons and programs where young builders ship real AI products on Cencori.",
    industry: "Community",
    useCase: "Hackathons",
    product: "API",
    publishedAt: "2026-09-05",
    cover: "/stories/ypit-event.jpg",
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

export function getStories(kind?: StoryKind): Story[] {
  return kind ? stories.filter((story) => story.kind === kind) : stories;
}

/** The one address a story lives at. */
export function storyHref(story: Pick<Story, "kind" | "slug">): string {
  return story.kind === "customer" ? `/customers/${story.slug}` : `/stories/${story.slug}`;
}

export function getStoryFacets(stories: Story[]) {
  const industries = [...new Set(stories.map((s) => s.industry))].sort();
  const useCases = [...new Set(stories.map((s) => s.useCase))].sort();
  return { industries, useCases };
}
