"use client";

import Link from "next/link";
import { navigationMenus, type NavigationMenuId } from "./nav-data";
import { socials } from "./socials";
import styles from "./SiteNav.module.css";

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
            <p className={styles.mobileSubLabel}>{subData.secondaryLabel}</p>
            <div className={styles.mobileSecondaryList}>
              {subData.secondary.map((item) => (
                <Link href={item.href} key={item.label} onClick={onNavigate}>
                  {item.label}
                </Link>
              ))}
            </div>
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
