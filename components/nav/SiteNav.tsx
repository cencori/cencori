"use client";

import { ArrowUpRight03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
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

type PreviewChip = { readonly label: string; readonly href: string };

type GroupedItem = {
  readonly href: string;
  readonly label: string;
  readonly tagline?: string;
  readonly description: string;
  readonly preview?: readonly PreviewChip[];
  readonly link?: { readonly href: string; readonly label: string };
};

type ItemGroup = {
  readonly label: string;
  readonly items: readonly GroupedItem[];
};

type StaticGroup = {
  readonly label: string;
  readonly items: readonly PreviewChip[];
};

function GroupedMegaMenu({
  id,
  label,
  groups,
  staticGroups,
  onNavigate,
}: {
  id: string;
  label: string;
  groups: readonly ItemGroup[];
  staticGroups?: readonly StaticGroup[];
  onNavigate: () => void;
}) {
  const items = groups.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label })),
  );
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const active = items.find((item) => item.label === activeLabel) ?? null;
  const hasStatic =
    Array.isArray(staticGroups) && staticGroups.length > 0;

  return (
    <section
      aria-label={`${label} navigation`}
      className={styles.megaMenu}
      id={`mega-menu-${id}`}
    >
      <div
        className={`${styles.megaMenuInner} ${hasStatic ? styles.megaMenuInnerInfra : styles.megaMenuInnerProducts}`}
      >
        <div
          className={
            groups.length > 1 ? styles.productsGroups : styles.singleGroup
          }
        >
          {groups.map((group) => (
            <div className={styles.productGroup} key={group.label}>
              <p className={styles.productGroupLabel}>{group.label}</p>
              <div
                aria-label={`${group.label} ${label.toLowerCase()}`}
                className={styles.megaLinkList}
              >
                {group.items.map((item) => {
                  const isActive = active?.label === item.label;
                  return (
                    <Link
                      className={
                        isActive
                          ? `${styles.productItem} ${styles.productItemActive}`
                          : styles.productItem
                      }
                      data-active={isActive ? "" : undefined}
                      href={item.href}
                      key={item.label}
                      onClick={onNavigate}
                      onFocus={() => setActiveLabel(item.label)}
                      onMouseEnter={() => setActiveLabel(item.label)}
                    >
                      <span className={styles.productItemLabel}>
                        <span>{item.label}</span>
                        <HugeiconsIcon
                          color="currentColor"
                          icon={ArrowUpRight03Icon}
                          size={14}
                          strokeWidth={1.9}
                        />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.productPreview} aria-live="polite">
          {active ? (
            <div className={styles.productPreviewBody} key={active.label}>
              <p className={styles.productPreviewTitle}>{active.label}</p>
              <p className={styles.productPreviewDesc}>{active.description}</p>
              {active.preview ? (
                <ul className={styles.productChips}>
                  {active.preview.map((chip, index) => (
                    <li
                      key={chip.label}
                      style={{ "--chip-index": index } as CSSProperties}
                    >
                      <Link href={chip.href} onClick={onNavigate}>
                        {chip.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {active.link ? (
                <Link
                  className={styles.productPreviewLink}
                  href={active.link.href}
                  onClick={onNavigate}
                >
                  <span>{active.link.label}</span>
                  <HugeiconsIcon
                    color="currentColor"
                    icon={ArrowUpRight03Icon}
                    size={14}
                    strokeWidth={1.9}
                  />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {staticGroups && staticGroups.length > 0
          ? staticGroups.map((group) => (
              <div className={styles.staticGroup} key={group.label}>
                <p className={styles.productGroupLabel}>{group.label}</p>
                <div
                  aria-label={`${group.label}`}
                  className={styles.megaLinkList}
                >
                  {group.items.map((item) => (
                    <Link
                      className={styles.deployLink}
                      href={item.href}
                      key={item.label}
                      onClick={onNavigate}
                    >
                      <span>{item.label}</span>
                      <HugeiconsIcon
                        color="currentColor"
                        icon={ArrowUpRight03Icon}
                        size={13}
                        strokeWidth={1.9}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ))
          : null}
      </div>
    </section>
  );
}

function MegaMenu({
  menu,
  onNavigate,
}: {
  menu: (typeof navigationMenus)[number];
  onNavigate: () => void;
}) {
  if (menu.id === "products") {
    return (
      <GroupedMegaMenu
        id={menu.id}
        label={menu.label}
        groups={menu.groups}
        onNavigate={onNavigate}
      />
    );
  }

  if (menu.id === "infrastructure") {
    return (
      <GroupedMegaMenu
        id={menu.id}
        label={menu.label}
        groups={menu.groups}
        staticGroups={menu.staticGroups}
        onNavigate={onNavigate}
      />
    );
  }

  if (menu.id === "industries" || menu.id === "research") {
    return (
      <GroupedMegaMenu
        id={menu.id}
        label={menu.label}
        groups={menu.groups}
        staticGroups={"staticGroups" in menu ? menu.staticGroups : undefined}
        onNavigate={onNavigate}
      />
    );
  }

  const hasSecondary =
    "secondary" in menu &&
    Array.isArray(menu.secondary) &&
    menu.secondary.length > 0;

  return (
    <section
      aria-label={`${menu.label} navigation`}
      className={styles.megaMenu}
      id={`mega-menu-${menu.id}`}
    >
      <div
        className={`${styles.megaMenuInner} ${hasSecondary ? "" : styles.megaMenuInnerSingle} ${menu.id === "company" ? styles.megaMenuInnerCompany : ""}`.trim()}
        key={menu.id}
      >
        <div className={styles.megaPrimary}>
          <p className={styles.productGroupLabel}>{menu.eyebrow}</p>
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
                <span className={styles.megaPrimaryLabel}>
                  <span>{item.label}</span>
                  <HugeiconsIcon
                    color="currentColor"
                    icon={ArrowUpRight03Icon}
                    size={16}
                    strokeWidth={1.4}
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
        {hasSecondary ? (
        <div className={styles.staticGroup}>
          <p className={styles.productGroupLabel}>{menu.secondaryLabel}</p>
          <div
            aria-label={`${menu.label} additional links`}
            className={styles.megaLinkList}
          >
            {menu.secondary.map((item) => (
              <Link
                className={styles.deployLink}
                href={item.href}
                key={item.label}
                onClick={onNavigate}
              >
                <span>{item.label}</span>
                <HugeiconsIcon
                  color="currentColor"
                  icon={ArrowUpRight03Icon}
                  size={13}
                  strokeWidth={1.9}
                />
              </Link>
            ))}
          </div>
        </div>
        ) : null}
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
