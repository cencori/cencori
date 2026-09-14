"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./AboutThesis.module.css";

const STATEMENT =
  "AI began as something people accessed. It is becoming something the world operates — inside hospitals, banks, factories, networks, vehicles, and machines. Where computation happens now matters as much as the intelligence being computed. Infrastructure determines what can exist next. Built on Cencori. Run on Cencori.";

export function AboutThesis() {
  const sectionRef = useRef<HTMLElement>(null);
  const statementRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const statement = statementRef.current;
    if (!section || !statement) return;

    const words = Array.from(
      statement.querySelectorAll<HTMLElement>("[data-word]"),
    );
    if (words.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    statement.dataset.reveal = "on";

    const FLOOR = 0.14;
    const SOFTNESS = 5;
    const LEAD = 0.05;
    const TAIL = 0.3;
    let frame = 0;
    let running = false;

    const paint = () => {
      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      const runway = Math.max(1, rect.height - viewport);
      const pinned = Math.min(1, Math.max(0, -rect.top / runway));
      const progress = Math.min(
        1,
        Math.max(0, (pinned - LEAD) / (1 - LEAD - TAIL)),
      );
      const head = progress * (words.length + SOFTNESS);

      for (let index = 0; index < words.length; index += 1) {
        const local = Math.min(1, Math.max(0, (head - index) / SOFTNESS));
        words[index].style.opacity = (FLOOR + local * (1 - FLOOR)).toFixed(3);
      }
    };

    const loop = () => {
      paint();
      frame = requestAnimationFrame(loop);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!running) {
            running = true;
            loop();
          }
          return;
        }
        if (running) {
          running = false;
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "25% 0px 25% 0px" },
    );

    observer.observe(section);
    paint();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      delete statement.dataset.reveal;
      for (const word of words) word.style.opacity = "";
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className={styles.thesis}
      aria-labelledby="about-thesis-title"
    >
      <div className={styles.pin}>
        <div className={styles.frame}>
          <p className={styles.label} id="about-thesis-title">
            Our thesis
          </p>
          <div className={styles.body}>
            <p className={styles.statement} ref={statementRef}>
              {STATEMENT.split(" ").map((word, index) => (
                <span className={styles.word} data-word="" key={index}>
                  {word}{" "}
                </span>
              ))}
            </p>
            <Link
              className={styles.link}
              href="/thesis"
            >
              Read the thesis
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
