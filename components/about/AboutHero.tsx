"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import styles from "./AboutHero.module.css";

export function AboutHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const blur = useTransform(scrollYProgress, [0, 0.6], ["blur(0px)", "blur(12px)"]);

  return (
    <section ref={ref} className={styles.hero} aria-labelledby="about-hero-title">
      <div className={styles.pin}>
        <motion.div
          className={styles.inner}
          style={{ opacity, filter: blur }}
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className={styles.label}>Company</p>
          <h1 className={styles.statement} id="about-hero-title">
            Cencori is a deep technology company building the computing
            infrastructure AI runs on.
          </h1>
        </motion.div>
      </div>
    </section>
  );
}
