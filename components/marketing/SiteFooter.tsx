import Image from "next/image";
import Link from "next/link";
import { navigationMenus } from "@/components/nav/nav-data";
import { socials } from "@/components/nav/socials";
import styles from "./SiteFooter.module.css";

type FooterLink = { label: string; href: string };
type FooterSection = { title?: string; links: FooterLink[] };

const MOBILE_SHORT_LABELS: Record<string, string> = {
  "Model Infrastructure": "Models",
  "Agentic Infrastructure": "Agents",
  "Research & Universities": "Research",
  "Edge & Physical AI": "Edge",
  "Healthcare & Life Sciences": "Healthcare",
  "Manufacturing & Industrial": "Manufacturing",
  "Energy & Resources": "Energy",
  "Government & Public Systems": "Government",
  "Defence & National Security": "Defence",
  "Agriculture & Food Systems": "Agriculture",
  "Mobility & Autonomous Systems": "Mobility",
  "Physical AI & Robotics": "Physical AI",
  "Security, Reliability & Governance": "Security",
  "Sovereign Infrastructure": "Sovereign",
};

function mobileLabel(label: string): string {
  const override = MOBILE_SHORT_LABELS[label];
  if (override) return override;
  const amp = label.split(" & ")[0];
  if (amp !== label) return amp;
  return label;
}

function getMenuSections(
  menu: (typeof navigationMenus)[number],
): FooterSection[] {
  if ("groups" in menu) {
    const groups = menu.groups as readonly {
      label: string;
      items: readonly FooterLink[];
    }[];
    const mainLinks = groups.flatMap((group) =>
      group.items.map((item) => ({ label: item.label, href: item.href })),
    );
    const sections: FooterSection[] = [{ links: mainLinks }];
    if (
      "staticGroups" in menu &&
      Array.isArray((menu as { staticGroups?: unknown }).staticGroups)
    ) {
      const staticGroups = (
        menu as {
          staticGroups: readonly { label: string; items: readonly FooterLink[] }[];
        }
      ).staticGroups;
      for (const group of staticGroups) {
        sections.push({
          title: group.label,
          links: group.items.map((item) => ({
            label: item.label,
            href: item.href,
          })),
        });
      }
    }
    return sections;
  }
  const primary =
    "primary" in menu && Array.isArray(menu.primary)
      ? menu.primary.map((item) => ({ label: item.label, href: item.href }))
      : [];
  const secondary =
    "secondary" in menu && Array.isArray(menu.secondary)
      ? menu.secondary.map((item) => ({ label: item.label, href: item.href }))
      : [];
  return [{ links: [...primary, ...secondary] }];
}

export function SiteFooter({ bottomGlow }: { bottomGlow?: React.ReactNode }) {
  return (
    <footer className={styles.footer}>
      {bottomGlow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden"
        >
          {bottomGlow}
        </div>
      ) : null}
      <div className={styles.footerMain}>
        <nav aria-label="Footer" className={styles.footerNav}>
          {navigationMenus
            .filter((menu) => menu.id !== "industries")
            .map((menu) => (
            <div key={menu.id}>
              <p className={styles.footerColTitle}>{menu.label}</p>
              {getMenuSections(menu).map((section, index) => (
                <div key={`${menu.id}-section-${index}`}>
                  {section.title ? (
                    <p className={styles.footerColSubTitle}>{section.title}</p>
                  ) : null}
                  <ul className={styles.footerColList}>
                    {section.links.map((link) => (
                      <li key={`${menu.id}-${link.href}-${link.label}`}>
                        <Link href={link.href}>
                          <span className={styles.footerFullLabel}>
                            {link.label}
                          </span>
                          <span className={styles.footerShortLabel}>
                            {mobileLabel(link.label)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.footerTop}>
          <Image
            alt="Cencori"
            className={styles.footerMark}
            height={48}
            src="/white-mark-96.png"
            width={48}
          />
        </div>
      </div>

      <div className={styles.footerMeta}>
        <ul className={styles.footerSocials}>
          {socials.map((social) => (
            <li key={social.href}>
              <a
                aria-label={social.label}
                href={social.href}
                rel="noreferrer"
                target="_blank"
              >
                <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                  <path d={social.path} />
                </svg>
              </a>
            </li>
          ))}
        </ul>

        <span>© 2026 Cencori, Inc.</span>

        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>

      <Image
        alt=""
        aria-hidden="true"
        className={styles.footerWordmark}
        height={628}
        loading="lazy"
        sizes="100vw"
        src="/logos/w.png"
        width={5237}
      />
    </footer>
  );
}
