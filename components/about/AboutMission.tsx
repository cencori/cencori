"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import styles from "./AboutMission.module.css";

const STATEMENT =
  "Make the infrastructure required to build and run AI accessible to everyone, everywhere.";

export function AboutMission() {
  const sectionRef = useRef<HTMLElement>(null);
  const statementRef = useRef<HTMLHeadingElement>(null);

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
    const SOFTNESS = 4;
    const LEAD = 0.05;
    const TAIL = 0.65;
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
      className={styles.mission}
      aria-labelledby="about-mission-title"
    >
      <div className={styles.pin}>
        <div className={styles.stage}>
          <div className={styles.frame}>
            <p className={styles.label}>Our mission</p>
            <h2 className={styles.statement} id="about-mission-title" ref={statementRef}>
              {STATEMENT.split(" ").map((word, index) => (
                <span className={styles.word} data-word="" key={index}>
                  {word}{" "}
                </span>
              ))}
            </h2>
            <figure className={styles.visual}>
              <Image
                alt="People crossing a city street in golden evening light"
                className={styles.image}
                height={1308}
                sizes="(max-width: 900px) 100vw, 50vw"
                src="/brand/about-mission-street.jpg"
                width={736}
              />
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
