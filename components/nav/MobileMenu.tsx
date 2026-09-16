"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  developerNavigationMenus,
  navigationMenus,
} from "./nav-data";
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
  menus,
  open,
  sub,
  onSelectSub,
  onNavigate,
}: {
  menus:
    | typeof navigationMenus
    | typeof developerNavigationMenus;
  open: boolean;
  sub: string | null;
  onSelectSub: (id: string | null) => void;
  onNavigate: () => void;
}) {
  const subData = menus.find((menu) => menu.id === sub);
  const pathname = usePathname();
  const isDevelopers =
    pathname === "/developers" || pathname?.startsWith("/developers/");

  return (
    <div
      className={`${styles.mobileMenu} ${open ? styles.mobileMenuOpen : ""}`}
      id="future-menu"
    >
      <div className={styles.mobileMenuScroll}>
        {subData && !("href" in subData) ? (
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
            ) : "primary" in subData ? (
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
            ) : null}
          </div>
        ) : (
          <div aria-label="Mobile navigation" className={styles.mobileMenuList}>
            {menus.map((item) =>
              "href" in item ? (
                <Link href={item.href} key={item.id} onClick={onNavigate}>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.id}
                  onClick={() => onSelectSub(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ),
            )}
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
          href={isDevelopers ? "/signup" : "/contact"}
          onClick={onNavigate}
        >
          {isDevelopers ? "Sign up" : "Talk to us"}
        </Link>
        {isDevelopers ? (
          <Link
            className={styles.mobileMenuLogin}
            href="/login"
            onClick={onNavigate}
          >
            Log in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
