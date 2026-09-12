"use client";

import { ArrowUpRight03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileMenu } from "./MobileMenu";
import { navigationMenus, type NavigationMenuId } from "./nav-data";
import styles from "./SiteNav.module.css";

function CencoriLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      alt="Cencori"
      className={`${styles.logo} ${className}`.trim()}
      height={63}
      priority
      sizes="(max-width: 720px) 120px, 200px"
      src="/logos/w.png"
      width={524}
    />
  );
}

function MegaMenu({
  menu,
  onNavigate,
}: {
  menu: (typeof navigationMenus)[number];
  onNavigate: () => void;
}) {
  return (
    <section
      aria-label={`${menu.label} navigation`}
      className={styles.megaMenu}
      id={`mega-menu-${menu.id}`}
    >
      <div className={styles.megaMenuInner} key={menu.id}>
        <div className={styles.megaPrimary}>
          <p className={styles.megaKicker}>{menu.eyebrow}</p>
          <div
            aria-label={`${menu.label} featured links`}
            className={styles.megaLinkList}
          >
            {menu.primary.map((item) => (
              <Link
                className={styles.megaPrimaryLink}
                href={item.href}
                key={item.label}
                onClick={onNavigate}
              >
                <span>{item.label}</span>
                <HugeiconsIcon
                  color="currentColor"
                  icon={ArrowUpRight03Icon}
                  size={16}
                  strokeWidth={1.4}
                />
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.megaSecondary}>
          <p className={styles.megaKicker}>{menu.secondaryLabel}</p>
          <div
            aria-label={`${menu.label} additional links`}
            className={styles.megaLinkList}
          >
            {menu.secondary.map((item) => (
              <Link
                className={styles.megaSecondaryLink}
                href={item.href}
                key={item.label}
                onClick={onNavigate}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SiteNav({
  className = "",
  solid = false,
}: {
  className?: string;
  solid?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<NavigationMenuId | null>(null);
  const [mobileSub, setMobileSub] = useState<NavigationMenuId | null>(null);
  const activeMenuData = navigationMenus.find((menu) => menu.id === activeMenu);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMobile = () => {
    setMenuOpen(false);
    setMobileSub(null);
  };

  return (
    <div
      className={[
        styles.navShell,
        solid ? styles.siteNavSolid : "",
        activeMenuData ? styles.navShellOpen : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setActiveMenu(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setActiveMenu(null);
          (event.target as HTMLElement).blur();
        }
      }}
      onMouseLeave={() => setActiveMenu(null)}
    >
      <header className={solid ? styles.navSolid : styles.nav}>
        <Link className={styles.brand} href="/" aria-label="Cencori home">
          <CencoriLogo className={styles.brandLogo} />
        </Link>

        <div aria-label="Primary navigation" className={styles.desktopNav}>
          {navigationMenus.map((menu) => (
            <button
              aria-controls={`mega-menu-${menu.id}`}
              aria-expanded={activeMenu === menu.id}
              className={styles.navTrigger}
              data-active={activeMenu === menu.id ? "" : undefined}
              key={menu.id}
              onClick={() =>
                setActiveMenu((current) =>
                  current === menu.id ? null : menu.id,
                )
              }
              onFocus={() => setActiveMenu(menu.id)}
              onMouseEnter={() => setActiveMenu(menu.id)}
              type="button"
            >
              {menu.label}
            </button>
          ))}
        </div>

        <div className={styles.navActions}>
          <Link className={styles.navCta} href="/contact">
            Talk to us
            <HugeiconsIcon
              color="currentColor"
              icon={ArrowUpRight03Icon}
              size={14}
              strokeWidth={1.9}
            />
          </Link>
        </div>

        <button
          className={styles.menuButton}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="future-menu"
          onClick={() => {
            if (menuOpen) closeMobile();
            else setMenuOpen(true);
          }}
        >
          <span>{menuOpen ? "Close" : "Menu"}</span>
        </button>
      </header>

      {activeMenuData ? (
        <>
          <div
            className={solid ? styles.navBackdropSolid : styles.navBackdrop}
            aria-hidden="true"
          />
          <MegaMenu menu={activeMenuData} onNavigate={() => setActiveMenu(null)} />
        </>
      ) : null}

      <MobileMenu
        onNavigate={closeMobile}
        onSelectSub={setMobileSub}
        open={menuOpen}
        sub={mobileSub}
      />
    </div>
  );
}
