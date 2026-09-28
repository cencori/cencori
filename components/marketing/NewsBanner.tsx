import { ArrowUpRight03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import styles from "./NewsBanner.module.css";

export type NewsBannerProps = {
  title: string;
  href: string;
};

export function NewsBanner({ title, href }: NewsBannerProps) {
  return (
    <section aria-label="News announcement">
      <Link className={styles.banner} href={href}>
        <span className={styles.headline}>{title}</span>
        <span className={styles.action}>
          <span className={styles.actionText}>Read more</span>
          <HugeiconsIcon
            aria-hidden="true"
            className={styles.arrow}
            icon={ArrowUpRight03Icon}
            size={16}
            strokeWidth={1.5}
          />
        </span>
      </Link>
    </section>
  );
}
