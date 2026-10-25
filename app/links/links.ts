import { socials } from "@/components/nav/socials";

// Every link is absolute: this page is served from links.cencori.com, where a
// relative href would resolve against the links host, not the main site.
const SITE = "https://cencori.com";

// Tagged so event traffic is separable in analytics. Change per event.
const UTM = "utm_source=links&utm_medium=event";

function tagged(href: string) {
  if (!href.startsWith(SITE)) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${UTM}`;
}

export type LinkItem = {
  label: string;
  description: string;
  href: string;
};

// The featured card at the top. Swap it for whatever the event is about.
export const featured = {
  eyebrow: "New",
  label: "Tensor",
  description: "The AI that builds with you.",
  href: tagged(`${SITE}/tensor`),
  image: "/brand/tensor-studio.jpg",
};

export const links: LinkItem[] = [
  {
    label: "Website",
    description: "The computing infrastructure AI runs on",
    href: tagged(SITE),
  },
  {
    label: "Start building",
    description: "Free account, one API for every model",
    href: tagged(`${SITE}/signup`),
  },
  {
    label: "Arcie",
    description: "Filesystem-first agent framework",
    href: tagged(`${SITE}/arcie`),
  },
  {
    label: "Docs",
    description: "Gateway, memory, agents, voice and more",
    href: tagged(`${SITE}/docs`),
  },
  {
    label: "Newsroom",
    description: "Announcements and press",
    href: tagged(`${SITE}/newsroom`),
  },
  {
    label: "Talk to us",
    description: "Partnerships, enterprise and press",
    href: tagged(`${SITE}/contact`),
  },
];

export const socialLinks = socials.map((social) => ({
  ...social,
  href: social.href.startsWith("/") ? `${SITE}${social.href}` : social.href,
}));
