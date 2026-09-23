"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { usePathname } from "next/navigation";
import { SiteNav } from "./SiteNav";

const TRANSPARENT_ROUTES = ["/about"];

// Transparent overlay for About: floats above the pinned Company hero,
// holds through its fade, then slides away as the next section arrives.
function TransparentAboutNav() {
  const { scrollY } = useScroll();
  const [range, setRange] = useState<[number, number]>([1e9, 1e9 + 1]);

  useEffect(() => {
    const compute = () =>
      setRange([window.innerHeight * 0.55, window.innerHeight * 0.95]);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const y = useTransform(scrollY, range, ["0%", "-110%"]);

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-40 bg-transparent"
      style={{ y }}
    >
      <SiteNav />
    </motion.div>
  );
}

const SCROLL_SOLID_ROUTES = ["/thesis", "/contact", "/developers", "/ai-gateway", "/newsroom", "/models"];

export function MarketingNav() {
  const pathname = usePathname();
  const developersNav =
    pathname === "/models" || pathname?.startsWith("/models/") ||
    pathname === "/ai-gateway/models";
  if (
    SCROLL_SOLID_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return <ThesisScrollNav developers={developersNav} />;
  }
  const transparent = TRANSPARENT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!transparent) return <SiteNav solid />;
  return <TransparentAboutNav />;
}

// Thesis/developers style: transparent at the top, soft-fades to solid page
// background on scroll. Exported so standalone pages (e.g. /ai/models) can
// reuse the same nav behavior outside the marketing shell. `developers`
// forces the developers variant (menus, wordmark, actions) on routes where
// the pathname check would not trigger it.
export function ThesisScrollNav({ developers = false }: { developers?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled ? "bg-background" : "bg-transparent"
      }`}
    >
      <SiteNav developers={developers} />
    </div>
  );
}
