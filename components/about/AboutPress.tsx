import { getAllPosts } from "@/lib/blog";
import styles from "./AboutPress.module.css";

/** Outlet names by the site the article lives on. */
const OUTLETS: Record<string, string> = {
  "techcabal.com": "TechCabal",
  "techloy.com": "Techloy",
  "connectingafrica.com": "Connecting Africa",
  "iafrica.com": "iAfrica",
  "thegeekcircle.com": "The Geek Circle",
  "au-startups.com": "AU-Startups",
};

function outletFor(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return OUTLETS[host] ?? host;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Coverage from other outlets: every press entry that links out to its article. */
export function AboutPress() {
  const coverage = getAllPosts().filter(
    (post) => post.category === "press" && post.externalUrl,
  );
  if (coverage.length === 0) return null;

  return (
    <section
      aria-labelledby="about-press-title"
      className={styles.press}
      id="press"
    >
      <p className={styles.label} id="about-press-title">
        In the news
      </p>
      <ul className={styles.list}>
        {coverage.map((post) => (
          <li key={post.slug}>
            <a
              className={styles.row}
              href={post.externalUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className={styles.outlet}>
                {outletFor(post.externalUrl as string)}
              </span>
              <span className={styles.headline}>{post.title}</span>
              <span className={styles.date}>
                {formatDate(post.date)}
                <span aria-hidden="true" className={styles.arrow}>
                  ↗
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
