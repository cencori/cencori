"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  AudioWaveform,
  Bot,
  Brain,
  CircuitBoard,
  Cpu,
  Factory,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Landmark,
  Layers,
  Rocket,
  Sparkles,
  Terminal,
} from "lucide-react";

// Drop images in /public/developers/ and set `image`, e.g. "/developers/build-apps.png".
// When `image` is empty a gradient + icon placeholder renders instead.
const SLIDES = [
  {
    icon: AppWindow,
    title: "AI applications",
    headline: "Copilots, assistants, search, recommendation",
    description:
      "Ship copilots, assistants, search, internal tools and customer-facing AI with routing, fallbacks and guardrails built in.",
    cta: "Build apps",
    href: "/developers/apis",
    image: "/developers/build-apps.webp",
    gradient:
      "radial-gradient(120% 100% at 20% 0%, #2b3fd6 0%, #101a5e 45%, #05081f 100%)",
  },
  {
    icon: Bot,
    title: "AI agents",
    headline: "Autonomous workflows, research, coding, support",
    description:
      "Run research, coding, support and operational agents with memory, tools, deployment and observability.",
    cta: "Deploy agents",
    href: "/developers/agent-deployment",
    image: "/developers/build-agents.webp",
    gradient:
      "radial-gradient(120% 100% at 80% 0%, #0ea5a4 0%, #0b2b4e 50%, #040918 100%)",
  },
  {
    icon: Rocket,
    title: "AI companies",
    headline: "Startups whose core product runs on AI",
    description:
      "Models, agents, memory, inference and custom infrastructure for startups whose core product runs on AI.",
    cta: "Start up",
    href: "/solutions/startups",
    image: "/developers/build-companies.webp",
    gradient:
      "radial-gradient(120% 100% at 50% 0%, #6366f1 0%, #1e1b4b 55%, #060312 100%)",
  },
  {
    icon: Brain,
    title: "Custom models",
    headline: "Train, fine-tune, evaluate, deploy your own",
    description:
      "Access 100+ frontier models through one API, or train, fine-tune, evaluate, deploy and serve your own.",
    cta: "Explore models",
    href: "/developers/inference",
    image: "",
    gradient:
      "radial-gradient(120% 100% at 20% 100%, #7c3aed 0%, #2e1065 55%, #070312 100%)",
  },
  {
    icon: Layers,
    title: "Multimodal systems",
    headline: "Text, image, audio, video, documents",
    description:
      "Combine text, image, audio, video, documents and structured data in one pipeline.",
    cta: "Build multimodal",
    href: "/developers/multimodal",
    image: "/developers/build-multimodal-glass.webp",
    gradient:
      "radial-gradient(120% 100% at 80% 100%, #8b5cf6 0%, #312e81 50%, #0a0618 100%)",
  },
  {
    icon: AudioWaveform,
    title: "Voice AI",
    headline: "Assistants, call systems, speech interfaces",
    description:
      "Ship realtime assistants, call systems, transcription and synthesis products.",
    cta: "Build voice",
    href: "/developers/voice",
    image: "/developers/build-voice.webp",
    gradient:
      "radial-gradient(120% 100% at 80% 100%, #f43f5e 0%, #3b0a2e 50%, #08040f 100%)",
  },
  {
    icon: Terminal,
    title: "Developer tools",
    headline: "Coding tools, testing, evaluation, observability",
    description:
      "Coding tools, model tooling, testing, evaluation and observability for AI infrastructure products.",
    cta: "Get SDKs",
    href: "/developers/sdks",
    image: "/developers/build-devtools.webp",
    gradient:
      "radial-gradient(120% 100% at 20% 0%, #10b981 0%, #064e3b 50%, #02120c 100%)",
  },
  {
    icon: FlaskConical,
    title: "Research systems",
    headline: "Experiments, simulations, knowledge systems",
    description:
      "Scientific models, experiments, simulations, evaluation pipelines and knowledge systems.",
    cta: "Explore research",
    href: "/research",
    image: "/developers/build-research.webp",
    gradient:
      "radial-gradient(120% 100% at 50% 0%, #06b6d4 0%, #164e63 50%, #030a0f 100%)",
  },
  {
    icon: Cpu,
    title: "Robotics",
    headline: "Robots, drones, vehicles, fleet systems",
    description:
      "Physical AI for robots, drones, vehicles and fleet systems, from simulation to deployment.",
    cta: "Start building",
    href: "/signup",
    image: "/developers/build-robotics.webp",
    gradient:
      "radial-gradient(120% 100% at 80% 0%, #f97316 0%, #431407 55%, #0a0503 100%)",
  },
  {
    icon: Factory,
    title: "Industrial AI",
    headline: "Inspection, optimization, digital twins",
    description:
      "Inspection, optimization, predictive systems, digital twins and machine intelligence.",
    cta: "Start building",
    href: "/signup",
    image: "/developers/build-industrial.webp",
    gradient:
      "radial-gradient(120% 100% at 20% 0%, #78716c 0%, #292524 55%, #0a0908 100%)",
  },
  {
    icon: Landmark,
    title: "Financial AI",
    headline: "Fraud, risk, credit, compliance",
    description:
      "Fraud, risk, credit, compliance, financial operations and customer intelligence.",
    cta: "Explore fintech",
    href: "/solutions/fintech",
    image: "/developers/build-financial.webp",
    gradient:
      "radial-gradient(120% 100% at 50% 100%, #22c55e 0%, #14532d 55%, #030a05 100%)",
  },
  {
    icon: HeartPulse,
    title: "Healthcare AI",
    headline: "Diagnostics, imaging, clinical systems",
    description:
      "Diagnostics, imaging, clinical systems, research and medical workflows.",
    cta: "Explore healthcare",
    href: "/solutions/healthcare",
    image: "/developers/build-healthcare.webp",
    gradient:
      "radial-gradient(120% 100% at 20% 100%, #ef4444 0%, #450a0a 55%, #0c0303 100%)",
  },
  {
    icon: GraduationCap,
    title: "Education systems",
    headline: "Learning tools, research assistants, labs",
    description:
      "Learning tools, research assistants, lab systems and student projects.",
    cta: "Start building",
    href: "/signup",
    image: "/developers/build-education.webp",
    gradient:
      "radial-gradient(120% 100% at 80% 0%, #eab308 0%, #422006 55%, #0a0703 100%)",
  },
  {
    icon: CircuitBoard,
    title: "Hardware-connected AI",
    headline: "Sensors, cameras, edge, embedded",
    description:
      "Sensors, cameras, edge devices, embedded systems and intelligent machines.",
    cta: "Start building",
    href: "/signup",
    image: "/developers/build-hardware.webp",
    gradient:
      "radial-gradient(120% 100% at 50% 0%, #14b8a6 0%, #134e4a 55%, #020c0b 100%)",
  },
  {
    icon: Sparkles,
    title: "New categories",
    headline: "Things that don't fit existing categories yet",
    description:
      "From edge devices to categories that don't exist yet — if you can imagine it, build it on Cencori.",
    cta: "Start building",
    href: "/signup",
    image: "",
    gradient:
      "radial-gradient(120% 100% at 50% 0%, #f59e0b 0%, #40200a 50%, #0a0603 100%)",
  },
];

const VISIBLE = 7;
// Desktop follows a steep editorial taper: hero, two readable previews,
// one compact preview, then three image rails.
const GROW = [14, 3.76, 1.65, 0.8, 0.18, 0.12, 0.08];
const CARD_TRANSITION_SECONDS = 0.8;
const CARD_CLEANUP_MS = 1000;

type BuildSlide = (typeof SLIDES)[number];

const MOBILE_CARD_VARIANTS = {
  enter: (direction: 1 | -1) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0.68,
    scale: 0.97,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: 1 | -1) => ({
    x: direction > 0 ? "-28%" : "28%",
    opacity: 0,
    scale: 0.985,
  }),
};

function BuildCardVisual({
  slide,
  isActive,
  reducedMotion,
}: {
  slide: BuildSlide;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  return (
    <>
      {slide.image ? (
        <Image
          alt={slide.title}
          className={`absolute inset-0 h-full w-full object-cover transition-transform ${
            reducedMotion
              ? ""
              : "duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          } ${isActive ? "scale-100" : "scale-110"}`}
          draggable={false}
          fill
          sizes="(max-width: 640px) 90vw, 70vw"
          src={slide.image}
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: slide.gradient }}
        />
      )}
      {!slide.image && (
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(80% 80% at 50% 40%, black 30%, transparent 100%)",
          }}
        />
      )}
      <span
        className={`absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent transition-opacity duration-500 ${
          isActive ? "opacity-100" : "opacity-60"
        }`}
      />
      <span
        className={`absolute right-4 bottom-4 left-4 transition-all duration-500 ${
          isActive
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0"
        }`}
      >
        <span className="text-[15px] font-semibold tracking-tight text-white">
          {slide.title}
        </span>
      </span>
    </>
  );
}

export function DevelopersBuild() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [prevActive, setPrevActive] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enteredRef = useRef(false);

  // The loop still wraps, but nothing ever pops: a card leaving the
  // 7-visible window stays mounted while it shrinks/fades out, and a card
  // entering grows/fades in — no display:none in the middle of a transition.
  const navigate = useCallback(
    (target: number, nextDirection: 1 | -1) => {
      if (target === active) return;
      enteredRef.current = true;
      setDirection(nextDirection);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (reducedMotion) {
        setPrevActive(null);
      } else {
        setPrevActive(active);
        settleTimer.current = setTimeout(
          () => setPrevActive(null),
          CARD_CLEANUP_MS,
        );
      }
      setActive(target);
    },
    [active, reducedMotion],
  );

  const next = useCallback(() => {
    navigate((active + 1) % SLIDES.length, 1);
  }, [navigate, active]);
  const prev = useCallback(() => {
    navigate((active - 1 + SLIDES.length) % SLIDES.length, -1);
  }, [navigate, active]);
  const select = useCallback(
    (target: number) => {
      const forwardDistance =
        (target - active + SLIDES.length) % SLIDES.length;
      const backwardDistance =
        (active - target + SLIDES.length) % SLIDES.length;
      navigate(target, forwardDistance <= backwardDistance ? 1 : -1);
    },
    [active, navigate],
  );

  const handleMobileDragEnd = useCallback(
    (
      _: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo,
    ) => {
      const projectedOffset = info.offset.x + info.velocity.x * 0.16;
      if (projectedOffset < -56) next();
      else if (projectedOffset > 56) prev();
    },
    [next, prev],
  );

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slide = SLIDES[active];
  const nextSlide = SLIDES[(active + 1) % SLIDES.length];

  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              What can you build on Cencori?
            </h2>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              From apps and agents to models, voice and entirely new
              categories.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="mr-1 hidden text-[13px] text-muted-foreground tabular-nums sm:block">
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(SLIDES.length).padStart(2, "0")}
            </span>
            <button
              aria-label="Previous"
              className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
              onClick={prev}
              type="button"
            >
              <ArrowLeft className="size-4" strokeWidth={2.2} />
            </button>
            <button
              aria-label="Next"
              className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
              onClick={next}
              type="button"
            >
              <ArrowRight className="size-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="relative mt-8 h-[360px] overflow-hidden sm:hidden">
          <motion.div
            animate={{ opacity: 0.62, scale: 0.98 }}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-[calc(100%-24px)] w-[calc(100%-34px)] origin-left overflow-hidden rounded-lg border border-white/10"
            initial={
              reducedMotion ? false : { opacity: 0, scale: 0.965 }
            }
            key={`mobile-peek-${nextSlide.title}`}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <BuildCardVisual
              isActive={false}
              reducedMotion={reducedMotion}
              slide={nextSlide}
            />
          </motion.div>

          <AnimatePresence custom={direction} initial={false}>
            <motion.div
              animate="center"
              aria-label={`${slide.title}: ${slide.headline}`}
              aria-roledescription="slide"
              className="absolute inset-y-0 left-0 z-10 w-[calc(100%-34px)] touch-pan-y overflow-hidden rounded-lg border border-white/15 text-left"
              custom={direction}
              drag={reducedMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragDirectionLock
              dragElastic={0.72}
              dragMomentum={false}
              exit="exit"
              initial="enter"
              key={`mobile-active-${slide.title}`}
              onDragEnd={handleMobileDragEnd}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      x: {
                        type: "spring",
                        stiffness: 300,
                        damping: 34,
                        mass: 0.85,
                      },
                      opacity: { duration: 0.24, ease: "easeOut" },
                      scale: {
                        duration: 0.36,
                        ease: [0.22, 1, 0.36, 1],
                      },
                    }
              }
              variants={MOBILE_CARD_VARIANTS}
              whileDrag={reducedMotion ? undefined : { scale: 0.985 }}
            >
              <BuildCardVisual
                isActive
                reducedMotion={reducedMotion}
                slide={slide}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative mt-8 hidden sm:block">
          <div
            className="flex h-[460px] gap-3"
            onPointerDown={(e) => {
              dragStartX.current = e.clientX;
            }}
            onPointerUp={(e) => {
              if (dragStartX.current == null) return;
              const dx = e.clientX - dragStartX.current;
              if (dx < -48) next();
              else if (dx > 48) prev();
              dragStartX.current = null;
            }}
          >
            {SLIDES.map((s, i) => {
              // Circular position: active is always 0 (left), next 6 decay to the right.
              // Only 7 of 15 are visible at a time — the rest stay mounted but hidden.
              const pos =
                (i - active + SLIDES.length) % SLIDES.length;
              const posPrev =
                prevActive == null
                  ? Number.POSITIVE_INFINITY
                  : (i - prevActive + SLIDES.length) % SLIDES.length;
              const isActive = pos === 0;
              const isVisible = pos < VISIBLE;
              const isKept = isVisible || posPrev < VISIBLE;
              // A forward step moves the previous active slide outside the
              // visible window. Keep it on the left while it shrinks instead
              // of immediately reordering the still-large card to the end.
              const isExitingActive = !isVisible && posPrev === 0;
              // A backward step drops the previous rightmost card. Collapse
              // its leading gap with it so cleanup cannot nudge the row.
              const isExitingTail =
                !isVisible && posPrev === VISIBLE - 1;
              const isExiting = isExitingActive || isExitingTail;
              const grow = isVisible ? GROW[pos] : 0.0001;
              const narrow = pos >= 4;
              return (
                <motion.div
                  animate={{ flexGrow: grow, opacity: isVisible ? 1 : 0 }}
                  aria-label={`${s.title} — ${s.headline}`}
                  aria-hidden={!isVisible}
                  className={`relative overflow-hidden rounded-lg text-left ${
                    reducedMotion
                      ? "transition-none"
                      : "transition-[min-width,margin-left,margin-right,border-width] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  } ${
                    !isVisible || isActive
                      ? "min-w-0"
                      : narrow
                        ? "min-w-[8px]"
                        : pos === 3
                          ? "min-w-[46px]"
                          : "min-w-[72px]"
                  } ${
                    isExitingActive
                      ? "ml-0 -mr-2.5 sm:-mr-3"
                      : isExitingTail
                        ? "-ml-2.5 mr-0 sm:-ml-3"
                        : "ml-0 mr-0"
                  } ${isExiting ? "border-0" : "border"} ${
                    isActive
                      ? "border-white/15"
                      : "border-white/10"
                  } ${isVisible ? "" : "pointer-events-none"}`}
                  initial={
                    enteredRef.current && !reducedMotion
                      ? { flexGrow: 0.0001, opacity: 0 }
                      : false
                  }
                  key={s.title}
                  role="group"
                  style={{
                    flexBasis: 0,
                    order: isExitingActive ? -1 : pos,
                    display: isKept ? undefined : "none",
                  }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : {
                          flexGrow: {
                            duration: CARD_TRANSITION_SECONDS,
                            ease: [0.22, 1, 0.36, 1],
                          },
                          opacity: {
                            duration: CARD_TRANSITION_SECONDS,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }
                  }
                >
                  <BuildCardVisual
                    isActive={isActive}
                    reducedMotion={reducedMotion}
                    slide={s}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 sm:hidden">
          <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
            {String(active + 1).padStart(2, "0")} / {SLIDES.length}
          </span>
          <span className="relative h-px flex-1 overflow-hidden bg-white/15">
            <motion.span
              animate={{ scaleX: (active + 1) / SLIDES.length }}
              className="absolute inset-0 origin-left bg-white"
              initial={false}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
              }
            />
          </span>
          <span className="text-[11px] tracking-[0.16em] text-white/45 uppercase">
            Swipe
          </span>
        </div>

        <div className="mt-5 hidden items-center gap-1.5 sm:flex">
          {SLIDES.map((s, i) => (
            <button
              aria-label={`Go to ${s.title}`}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === active
                  ? "w-8 bg-white"
                  : "w-2 bg-white/20 hover:bg-white/40"
              }`}
              key={s.title}
              onClick={() => select(i)}
              type="button"
            />
          ))}
        </div>

        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="mt-6"
          initial={
            reducedMotion
              ? false
              : { opacity: 0, x: direction > 0 ? 20 : -20 }
          }
          key={active}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="max-w-2xl text-lg leading-snug text-balance sm:text-xl">
            <span className="font-semibold text-white">
              {slide.headline}.
            </span>{" "}
            <span className="text-muted-foreground">
              {slide.description}
            </span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
