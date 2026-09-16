"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BorderBeam } from "border-beam";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import styles from "./DevelopersHero.module.css";

const WORDS = [
  "AI company",
  "AI startup",
  "AI product",
  "AI agents",
  "AI app",
];

export function DevelopersHero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % WORDS.length),
      2600,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 pt-24 pb-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[620px] sm:block"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 50% -8%, rgba(216, 205, 255, 0.95) 0%, rgba(150, 124, 255, 0.5) 32%, rgba(88, 62, 190, 0.18) 55%, transparent 75%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] sm:hidden"
        style={{
          background:
            "radial-gradient(ellipse 95% 60% at 50% -8%, rgba(216, 205, 255, 0.95) 0%, rgba(150, 124, 255, 0.5) 35%, rgba(88, 62, 190, 0.18) 60%, transparent 78%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl text-center">
        <BorderBeam
          borderRadius={999}
          className="mb-8 inline-block"
          colorVariant="colorful"
          size="md"
          strength={0.59}
        >
          <Link
            className="group inline-flex items-center gap-2 rounded-full bg-white/5 py-2 pr-3 pl-4 text-[13px] text-white/80 backdrop-blur transition-colors hover:text-white"
            href="/blog/claude-fable-5-1-on-cencori"
          >
            Claude Fable 5.1 is on Cencori
            <HugeiconsIcon
              className="transition-transform duration-200 group-hover:translate-x-0.5"
              color="currentColor"
              icon={ArrowRight01Icon}
              size={14}
              strokeWidth={1.9}
            />
          </Link>
        </BorderBeam>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          <span className="block">Everything your</span>
          <span className="block">
            <span
              aria-atomic="true"
              aria-live="polite"
              className={styles.rotator}
            >
              <span className={styles.wordActive} key={index}>
                {WORDS[index]}
              </span>
            </span>{" "}
            needs to run.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          One API for every frontier model, infrastructure to train and
          deploy your own, and observability to run it all in production.
        </p>
        <div className="mt-8 flex flex-row items-center justify-center gap-3">
          <Button
            asChild
            className="group h-10 rounded-full pr-2 pl-5 text-sm font-semibold"
          >
            <Link href="/signup">
              Start building
              <HugeiconsIcon
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                color="currentColor"
                icon={ArrowRight01Icon}
                size={14}
                strokeWidth={1.9}
              />
            </Link>
          </Button>
          <Button
            asChild
            className="h-10 rounded-full px-5 text-sm font-semibold"
            variant="outline"
          >
            <Link href="/docs">Read the docs</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
