"use client";

import Link from "next/link";
import { navigationMenus, type NavigationMenuId } from "./nav-data";
import { socials } from "./socials";
import styles from "./SiteNav.module.css";

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
};

function mobileLabel(label: string): string {
  const override = MOBILE_SHORT_LABELS[label];
  if (override) return override;
  const amp = label.split(" & ")[0];
  if (amp !== label) return amp;
  return label;
}

export function MobileMenu({
  open,
  sub,
  onSelectSub,
  onNavigate,
}: {
  open: boolean;
  sub: NavigationMenuId | null;
  onSelectSub: (id: NavigationMenuId | null) => void;
  onNavigate: () => void;
}) {
  const subData = navigationMenus.find((menu) => menu.id === sub);

  return (
    <div
      className={`${styles.mobileMenu} ${open ? styles.mobileMenuOpen : ""}`}
      id="future-menu"
    >
      <div className={styles.mobileMenuScroll}>
        {subData ? (
          <div key={subData.id} className={styles.mobileSub}>
            <button
              className={styles.mobileBack}
              onClick={() => onSelectSub(null)}
              type="button"
            >
              <span aria-hidden="true">←</span> Menu
            </button>
            <p className={styles.mobileKicker}>{subData.eyebrow}</p>
            {"groups" in subData ? (
              <div className={styles.mobileGroups}>
                {subData.groups.map((group) => (
                  <div key={group.label}>
                    <p className={styles.mobileSubLabel}>{group.label}</p>
                    <div
                      aria-label={`${group.label} links`}
                      className={styles.mobileMenuList}
                    >
                      {group.items.map((item) => (
                        <div key={item.label}>
                          <Link href={item.href} onClick={onNavigate}>
                            {mobileLabel(item.label)}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {"staticGroups" in subData ? (
                  <>
                    {subData.staticGroups.map((group) => (
                      <div key={group.label}>
                        <p className={styles.mobileSubLabel}>{group.label}</p>
                        <div className={styles.mobileSecondaryList}>
                          {group.items.map((item) => (
                            <Link
                              href={item.href}
                              key={item.label}
                              onClick={onNavigate}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            ) : (
              <>
            <div
              aria-label={`${subData.label} links`}
              className={styles.mobileMenuList}
            >
              {subData.primary.map((item) => (
                <Link href={item.href} key={item.label} onClick={onNavigate}>
                  {item.label}
                </Link>
              ))}
            </div>
            {"secondary" in subData &&
            Array.isArray(subData.secondary) &&
            subData.secondary.length > 0 ? (
              <>
            <p className={styles.mobileSubLabel}>{subData.secondaryLabel}</p>
            <div className={styles.mobileSecondaryList}>
              {subData.secondary.map((item) => (
                <Link href={item.href} key={item.label} onClick={onNavigate}>
                  {item.label}
                </Link>
              ))}
            </div>
              </>
            ) : null}
              </>
            )}
          </div>
        ) : (
          <div aria-label="Mobile navigation" className={styles.mobileMenuList}>
            {navigationMenus.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectSub(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.mobileMenuFooter}>
        <ul className={styles.mobileSocials}>
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
        <Link
          className={styles.mobileMenuCta}
          href="/contact"
          onClick={onNavigate}
        >
          Talk to us
        </Link>
      </div>
    </div>
  );
}
