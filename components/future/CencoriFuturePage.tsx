"use client";

import { ArrowUpRight03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./CencoriFuturePage.module.css";

// `invert` marks logos supplied only as white-on-transparent. The rail sits on
// paper, so those are flipped to black - same mark, opposite polarity. Drop the
// flag once a partner supplies a dark lockup.
const partners = [
  {
    name: "Spitch",
    src: "/logos/partners/spitch.png",
    width: 1430,
    height: 316,
  },
  {
    invert: true,
    name: "Univad",
    src: "/logos/partners/univad-white.png",
    width: 3506,
    height: 810,
  },
  {
    // Solid slab letterforms carry far more ink than the lighter wordmarks
    // beside them, so this one sits optically level a little smaller.
    name: "Celo",
    scale: 0.72,
    src: "/logos/partners/celo.png",
    width: 4034,
    height: 913,
  },
];


const toWords = (text: string) =>
  text.split(" ").map((word, index) => ({ key: `${index}-${word}`, word }));

const developersLeadWords = toWords(
  "Learn more on how developers use Cencori to build, deploy and scale AI apps, AI agents and AI models.",
);

const missionLeadWords = toWords(
  "Make the infrastructure required to build and run AI accessible to everyone, everywhere.",
);

const thesisWords = [
  "AI is moving into every enterprise, industry, critical system, and machine.",
  "We are building what it will run on.",
]
  .join(" ")
  .split(" ")
  .map((word, index) => ({ key: `${index}-${word}`, word }));

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

function useScrollChoreography(
  sectionRef: RefObject<HTMLElement | null>,
  leadRef: RefObject<HTMLParagraphElement | null>,
  gridRef: RefObject<HTMLDivElement | null>,
  motion: boolean,
  viewportKey: number,
  settleKey: number,
) {
  // Choreography across the pinned runway: words reveal at display size, the
  // block collapses toward the top right, then the cards rise in behind it.
  useEffect(() => {
    if (!motion) return;

    const section = sectionRef.current;
    const lead = leadRef.current;
    const grid = gridRef.current;
    if (!section || !lead || !grid) return;

    const words = Array.from(
      lead.querySelectorAll<HTMLElement>("[data-lead-word]"),
    );
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-card]"));
    if (words.length === 0) return;

    const pane = section.querySelector<HTMLElement>("[data-pane]");
    if (!pane) return;

    // The pane pins wherever the whole composition fits the viewport, which
    // both layouts are sized to do. Anything that does not fit falls back to
    // the reveal alone rather than stranding content below a sticky fold.
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const narrow = !window.matchMedia("(min-width: 901px)").matches;
    const full = pane.scrollHeight <= viewport * 1.02;
    if (full) section.dataset.pin = "on";
    section.dataset.choreo = full ? "full" : "reveal";

    const FLOOR = 0.12;
    const SOFTNESS = 4;
    const REVEAL_IN = 0.04;
    const REVEAL_OUT = 0.42;
    const SHRINK_IN = 0.45;
    const SHRINK_OUT = 0.7;
    const CARDS_IN = 0.64;
    const CARDS_OUT = 0.92;
    const LEAD_REST = 1.3;
    const LEAD_BIG = 3.6;

    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const easeOut = (t: number) => 1 - (1 - t) ** 3;

    // offsetWidth/offsetLeft/offsetTop are layout values that transforms do
    // not affect, so these can be recomputed every frame without clearing the
    // transform first. offsetTop/Left are relative to the nearest *positioned*
    // ancestor though, and the header is not positioned, so walk each element
    // to the root and subtract rather than stopping at the ancestor.
    const rootOffset = (node: HTMLElement) => {
      let top = 0;
      let left = 0;
      let cursor: HTMLElement | null = node;
      while (cursor) {
        top += cursor.offsetTop;
        left += cursor.offsetLeft;
        cursor = cursor.offsetParent as HTMLElement | null;
      }
      return { left, top };
    };

    const offsetWithin = (node: HTMLElement, ancestor: HTMLElement) => {
      const a = rootOffset(node);
      const b = rootOffset(ancestor);
      return { left: a.left - b.left, top: a.top - b.top };
    };

    // At full size the block sits flush left and centred in the pane; as it
    // shrinks it travels back to its resting slot at the top right.
    const body = lead.parentElement;
    let maxScale = 1;
    let targetX = 0;
    let targetY = 0;

    const measure = () => {
      if (!body) return;
      const frame_ = full ? pane : body;
      // offsetLeft and clientWidth are both measured against the padding box,
      // so the header's own gutters have to come out. Without this the copy is
      // pulled a gutter's width past the column and grows too wide with it.
      const style = getComputedStyle(body);
      const padLeft = Number.parseFloat(style.paddingLeft) || 0;
      const padRight = Number.parseFloat(style.paddingRight) || 0;
      const bodyWidth = body.clientWidth - padLeft - padRight;
      const leadWidth = lead.offsetWidth;
      if (bodyWidth <= 0 || leadWidth === 0) return;

      // Never grow past the column: a block wider than its container bleeds
      // off both edges with no way to scroll to it.
      maxScale = Math.min(2.8, Math.max(1, bodyWidth / leadWidth));
      targetX = -(offsetWithin(lead, body).left - padLeft);
      targetY =
        (frame_.clientHeight - lead.offsetHeight * maxScale) / 2 -
        offsetWithin(lead, frame_).top;
    };

    let frame = 0;
    let running = false;

    const viewportHeight = () =>
      window.innerHeight || document.documentElement.clientHeight;

    const pinnedProgress = () => {
      const rect = section.getBoundingClientRect();
      const runway = Math.max(1, rect.height - viewportHeight());
      return clamp(-rect.top / runway);
    };

    const paintWords = (span: number) => {
      const revealed = span * (words.length + SOFTNESS);
      for (let index = 0; index < words.length; index += 1) {
        const local = clamp((revealed - index) / SOFTNESS);
        words[index].style.opacity = (FLOOR + local * (1 - FLOOR)).toFixed(3);
      }
    };

    // Narrow screens animate font-size rather than scale. A transform cannot
    // reflow, and at full column width there is no room to scale into - so the
    // copy would sit at one size. Driving the size lets it wrap like the thesis
    // at the top end and shrink back up under the eyebrow.
    const paintLead = (shrink: number) => {
      const grown = 1 - shrink;

      if (narrow) {
        const size = LEAD_REST + (LEAD_BIG - LEAD_REST) * grown;
        lead.style.fontSize = `${size.toFixed(3)}rem`;

        // Centred in the held frame while large, relaxing to its docked slot
        // under the eyebrow as it shrinks. Height is read after the size is
        // applied, since the copy re-wraps as it grows.
        if (full) {
          const centred =
            (pane.clientHeight - lead.offsetHeight) / 2 -
            offsetWithin(lead, pane).top;
          lead.style.transform = `translateY(${(centred * grown).toFixed(2)}px)`;
        }
        return;
      }

      measure();
      const scale = 1 + (maxScale - 1) * grown;
      lead.style.transform = `translate(${(targetX * grown).toFixed(2)}px, ${(targetY * grown).toFixed(2)}px) scale(${scale.toFixed(4)})`;
    };

    const paint = () => {
      if (!full) {
        // No pin: the copy reveals on its own trip up the viewport and each
        // card fades in as it arrives. No transforms, nothing held.
        const vh = viewportHeight();
        const leadRect = lead.getBoundingClientRect();
        const own = clamp(
          (vh * 0.86 - leadRect.top) / (leadRect.height + vh * 0.45),
        );
        paintWords(own);

        for (let index = 0; index < cards.length; index += 1) {
          const rect = cards[index].getBoundingClientRect();
          const local = easeOut(clamp((vh * 0.92 - rect.top) / (vh * 0.3)));
          cards[index].style.opacity = local.toFixed(3);
          cards[index].style.transform = `translateY(${((1 - local) * 2).toFixed(2)}rem)`;
        }
        return;
      }

      measure();
      const progress = pinnedProgress();

      paintWords(clamp((progress - REVEAL_IN) / (REVEAL_OUT - REVEAL_IN)));

      // Shared with the unpinned path so narrow screens get the font-size
      // animation here too; scaling alone does nothing at full column width.
      paintLead(
        easeInOut(clamp((progress - SHRINK_IN) / (SHRINK_OUT - SHRINK_IN))),
      );

      const entry = clamp((progress - CARDS_IN) / (CARDS_OUT - CARDS_IN));
      for (let index = 0; index < cards.length; index += 1) {
        const stagger = index * 0.22;
        const local = easeOut(clamp((entry - stagger) / (1 - stagger)));
        cards[index].style.opacity = local.toFixed(3);
        cards[index].style.transform = `translateY(${((1 - local) * 3.25).toFixed(2)}rem) scale(${(0.95 + local * 0.05).toFixed(4)})`;
      }
    };

    const loop = () => {
      paint();
      frame = requestAnimationFrame(loop);
    };

    const onResize = () => {
      measure();
      paint();
    };

    const observer = new IntersectionObserver(
      ([observed]) => {
        if (observed.isIntersecting) {
          if (!running) {
            running = true;
            loop();
          }
          return;
        }
        if (running) {
          running = false;
          cancelAnimationFrame(frame);
          frame = 0;
          paint();
        }
      },
      { rootMargin: "25% 0px 25% 0px" },
    );

    measure();
    paint();
    observer.observe(section);
    window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
      delete section.dataset.choreo;
      delete section.dataset.pin;
      lead.style.transform = "";
      lead.style.fontSize = "";
      for (const word of words) word.style.opacity = "";
      for (const card of cards) {
        card.style.opacity = "";
        card.style.transform = "";
      }
    };
  }, [sectionRef, leadRef, gridRef, motion, viewportKey, settleKey]);
}

export function CencoriFuturePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const beliefRef = useRef<HTMLElement>(null);
  const thesisRef = useRef<HTMLParagraphElement>(null);
  const developersRef = useRef<HTMLElement>(null);
  const leadRef = useRef<HTMLParagraphElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLElement>(null);
  const missionLeadRef = useRef<HTMLParagraphElement>(null);
  const missionGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Motion is on unless the visitor asked for less. Whether the section pins
  // is a separate, measured decision made inside the effect below.
  const [developerMotion, setDeveloperMotion] = useState(false);
  const [developerViewport, setDeveloperViewport] = useState(0);
  const [layoutSettled, setLayoutSettled] = useState(0);

  useEffect(() => {
    let alive = true;
    const settle = () => {
      if (alive) requestAnimationFrame(() => setLayoutSettled((n) => n + 1));
    };

    if (document.readyState === "complete") settle();
    else window.addEventListener("load", settle, { once: true });
    document.fonts?.ready.then(settle).catch(() => undefined);

    return () => {
      alive = false;
      window.removeEventListener("load", settle);
    };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const evaluate = () => {
      setDeveloperMotion(!reduced.matches);
      // Bucketed so ordinary scroll-driven chrome resizing on mobile does not
      // thrash the effect, while real rotations and window resizes do.
      setDeveloperViewport(
        Math.round(window.innerWidth / 40) * 1000 +
          Math.round(window.innerHeight / 80),
      );
    };

    evaluate();
    reduced.addEventListener("change", evaluate);
    window.addEventListener("resize", evaluate);
    window.addEventListener("orientationchange", evaluate);

    return () => {
      reduced.removeEventListener("change", evaluate);
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("orientationchange", evaluate);
    };
  }, []);


  useScrollChoreography(
    developersRef,
    leadRef,
    gridRef,
    developerMotion,
    developerViewport,
    layoutSettled,
  );

  useScrollChoreography(
    missionRef,
    missionLeadRef,
    missionGridRef,
    developerMotion,
    developerViewport,
    layoutSettled,
  );

  // Scroll-linked reveal. The statement is pinned, so progress is measured
  // against the runway the sticky pane travels through, not the text itself.
  useEffect(() => {
    const section = beliefRef.current;
    const statement = thesisRef.current;
    if (!section || !statement) return;

    const words = Array.from(
      statement.querySelectorAll<HTMLElement>("[data-word]"),
    );
    if (words.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    statement.dataset.reveal = "on";

    const FLOOR = 0.14;
    const SOFTNESS = 5;
    const LEAD = 0.06; // settle pinned before the first word lights
    const TAIL = 0.2; // hold the finished sentence before releasing
    let frame = 0;
    let running = false;

    const paint = () => {
      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      const runway = Math.max(1, rect.height - viewport);
      const pinned = Math.min(1, Math.max(0, -rect.top / runway));
      const progress = Math.min(
        1,
        Math.max(0, (pinned - LEAD) / (1 - LEAD - TAIL)),
      );
      const head = progress * (words.length + SOFTNESS);

      for (let index = 0; index < words.length; index += 1) {
        const local = Math.min(1, Math.max(0, (head - index) / SOFTNESS));
        words[index].style.opacity = (FLOOR + local * (1 - FLOOR)).toFixed(3);
      }
    };

    const loop = () => {
      paint();
      frame = requestAnimationFrame(loop);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!running) {
            running = true;
            loop();
          }
          return;
        }
        if (running) {
          running = false;
          cancelAnimationFrame(frame);
          frame = 0;
          paint();
        }
      },
      { rootMargin: "25% 0px 25% 0px" },
    );

    observer.observe(section);
    paint();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      delete statement.dataset.reveal;
      for (const word of words) word.style.opacity = "";
    };
  }, []);

  return (
    <main className={styles.site}>
      <section className={styles.hero} aria-labelledby="future-hero-title">
        <div className={styles.heroImage} aria-hidden="true" />
        <div className={styles.heroShade} aria-hidden="true" />

        <header className={styles.nav}>
          <Link className={styles.brand} href="/" aria-label="Cencori home">
            <CencoriLogo className={styles.brandLogo} />
          </Link>

          <nav className={styles.desktopNav} aria-label="Primary navigation">
            <a href="#developers">Developers</a>
            <a href="#infrastructure">Infrastructure</a>
            <a href="#industries">Industries</a>
            <a href="#research">Research</a>
            <a href="#company">Company</a>
          </nav>

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
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>{menuOpen ? "Close" : "Menu"}</span>
          </button>
        </header>

        <div className={styles.heroContent}>
          <h1 id="future-hero-title">The computing infrastructure AI runs on.</h1>
        </div>

        <div
          className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}
          id="future-menu"
        >
          <nav aria-label="Mobile navigation">
            {["Developers", "Infrastructure", "Industries", "Research", "Company"].map(
              (item) => (
                <a
                  href={`#${item.toLowerCase()}`}
                  key={item}
                  onClick={() => setMenuOpen(false)}
                >
                  {item}
                </a>
              ),
            )}
          </nav>
          <div className={styles.mobileMenuFooter}>
            <Link
              className={styles.mobileMenuCta}
              href="/contact"
              onClick={() => setMenuOpen(false)}
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.belief} id="belief" ref={beliefRef}>
        <div className={styles.beliefSticky}>
          <p className={styles.sectionEyebrow}>Our thesis</p>
          <p className={styles.beliefStatement} ref={thesisRef}>
            {thesisWords.map(({ key, word }) => (
              <span className={styles.thesisWord} data-word="" key={key}>
                {word}{" "}
              </span>
            ))}
          </p>
        </div>
      </section>

      <section className={styles.developers} id="developers" ref={developersRef}>
        <div className={styles.developersSticky} data-pane="">
          <div className={styles.pinStage}>
            <div className={styles.pinHeader}>
              <p className={styles.sectionEyebrow}>For developers</p>

              <p className={styles.pinLead} ref={leadRef}>
                {developersLeadWords.map(({ key, word }) => (
                  <span className={styles.leadWord} data-lead-word="" key={key}>
                    {word}{" "}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className={styles.pinBody}>
            <div className={styles.pinGrid} ref={gridRef}>
              <article className={styles.pinCard} data-card="">
                <Link
                  className={styles.pinPoster}
                  href="/developers"
                  aria-label="Explore Cencori for developers"
                >
                  <Image
                    alt="Cencori developers building together in the studio"
                    className={styles.pinPosterImage}
                    height={1024}
                    sizes="(max-width: 900px) 100vw, 33vw"
                    src="/brand/cencori-developers-studio.png"
                    width={1536}
                  />
                </Link>

                <div className={styles.pinStatement}>
                  <h2>
                    Build real applied AI solutions with the Cencori developer
                    API.
                  </h2>
                </div>
              </article>

              <article className={styles.pinCard} data-card="">
                <Link
                  className={styles.pinPoster}
                  href="/basecode"
                  aria-label="Explore Basecode"
                >
                  <Image
                    alt="A developer working with Basecode"
                    className={styles.pinPosterImage}
                    height={1086}
                    sizes="(max-width: 900px) 100vw, 33vw"
                    src="/brand/basecode-studio.jpg"
                    width={1448}
                  />
                </Link>

                <div className={styles.pinStatement}>
                  <h2>
                    Basecode: A powerful coding agent for everyone, everywhere.
                  </h2>
                </div>
              </article>

              <article className={styles.pinCard} data-card="">
                <Link
                  className={styles.pinPoster}
                  href="/arcie"
                  aria-label="Explore Arcie"
                >
                  <Image
                    alt="Arcie"
                    className={styles.pinPosterImage}
                    height={720}
                    sizes="(max-width: 900px) 100vw, 33vw"
                    src="/brand/arcie-studio.jpg"
                    width={720}
                  />
                </Link>

                <div className={styles.pinStatement}>
                  <h2>Arcie: First party agent framework by Cencori.</h2>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.mission} id="mission" ref={missionRef}>
        <div className={styles.missionSticky} data-pane="">
          <div className={styles.pinStage}>
            <div className={styles.pinHeader}>
              <p className={styles.sectionEyebrow}>Our mission</p>

              <p className={styles.pinLead} ref={missionLeadRef}>
                {missionLeadWords.map(({ key, word }) => (
                  <span className={styles.leadWord} data-lead-word="" key={key}>
                    {word}{" "}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className={styles.pinBody}>
            <div
              className={`${styles.pinGrid} ${styles.missionGrid}`}
              ref={missionGridRef}
            >
              <figure className={styles.missionVisual} data-card="">
                <Image
                  alt="A Cencori engineer working on server racks on a data centre floor"
                  className={styles.missionImage}
                  height={1024}
                  sizes="(max-width: 900px) calc(100vw - 2.5rem), calc(100vw - 4.5rem)"
                  src="/brand/cencori-mission-infrastructure.jpg"
                  width={1536}
                />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.partners} id="partners">
        <ul className={styles.partnerRail}>
          {partners.map((partner) => (
            <li key={partner.name}>
              <Image
                alt={partner.name}
                className={styles.partnerLogo}
                data-invert={partner.invert ? "" : undefined}
                style={
                  partner.scale
                    ? ({ "--logo-scale": partner.scale } as CSSProperties)
                    : undefined
                }
                height={partner.height}
                sizes="(max-width: 900px) 40vw, 180px"
                src={partner.src}
                width={partner.width}
              />
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerMeta}>
          <span>© 2026 CENCORI, INC.</span>
          <span>LAGOS / SAN FRANCISCO / THE NETWORK</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
