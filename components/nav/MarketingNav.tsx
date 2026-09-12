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

export function MarketingNav() {
  const pathname = usePathname();
  const transparent = TRANSPARENT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!transparent) return <SiteNav solid />;
  return <TransparentAboutNav />;
}
