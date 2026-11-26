import fs from "fs";
import path from "path";
import { getAllPosts } from "@/lib/blog";
import styles from "./AboutPress.module.css";

/**
 * Outlets by the site the article lives on. `file` names the logo in
 * public/logos/press (svg or png, white on transparent); until that file
 * exists the square shows the outlet's name instead.
 */
const OUTLETS: Record<string, { name: string; file: string }> = {
  "techcabal.com": { name: "TechCabal", file: "techcabal" },
  "techloy.com": { name: "Techloy", file: "techloy" },
  "connectingafrica.com": { name: "Connecting Africa", file: "connecting-africa" },
  "iafrica.com": { name: "iAfrica", file: "iafrica" },
  "thegeekcircle.com": { name: "The Geek Circle", file: "the-geek-circle" },
  "au-startups.com": { name: "AU-Startups", file: "au-startups" },
};

const LOGO_DIR = path.join(process.cwd(), "public", "logos", "press");

function outletFor(url: string): { name: string; logo: string | null } {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const outlet = OUTLETS[host];
  if (!outlet) return { name: host, logo: null };
  const ext = ["svg", "png"].find((candidate) =>
    fs.existsSync(path.join(LOGO_DIR, `${outlet.file}.${candidate}`)),
  );
  return {
    name: outlet.name,
    logo: ext ? `/logos/press/${outlet.file}.${ext}` : null,
  };
}

/** Coverage from other outlets: one square per article, linking out to it. */
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
      <div className={styles.viewport}>
        <ul className={styles.rail}>
          {coverage.map((post) => {
            const outlet = outletFor(post.externalUrl as string);
            return (
              <li key={post.slug}>
                <a
                  aria-label={`${outlet.name}: ${post.title}`}
                  className={styles.cell}
                  href={post.externalUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  title={post.title}
                >
                  {outlet.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className={styles.logo} src={outlet.logo} />
                  ) : (
                    <span className={styles.name}>{outlet.name}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
