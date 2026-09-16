import Image from "next/image";
import Link from "next/link";
import { ArcieChatSim } from "./ArcieChatSim";
import styles from "./DevelopersProducts.module.css";
import {
  Building2,
  ChevronRight,
  Database,
  Network,
  Zap,
} from "lucide-react";

const PRODUCTS = [
  {
    href: "/ai-gateway",
    icon: Network,
    image: "/gate.png",
    name: "AI Gateway",
    span: true,
    description:
      "One OpenAI-compatible API to 100+ frontier models, with routing, fallbacks and guardrails built in.",
  },
  {
    href: "/arcie",
    name: "Arcie",
    square: true,
    description: "",
  },
  {
    href: "/developers/billing",
    name: "Billing",
    tall: true,
    white: true,
    description: "",
  },
  {
    href: "/memory",
    icon: Database,
    image: "/mbrain.png",
    contain: true,
    light: true,
    name: "Memory",
    tile: true,
    description:
      "Give any model long-term memory across sessions — PII-redacted, region-pinned, audit-logged.",
  },
  {
    href: "/compute",
    icon: Zap,
    image: "/comp.png",
    contain: true,
    name: "Compute",
    tile: true,
    description:
      "Fast, reliable compute on any frontier model with autoscaling and regional pinning.",
  },
  {
    href: "/basecode",
    icon: Zap,
    image: "/bc.png",
    light: true,
    name: "Basecode",
    span: true,
    description: "",
  },
];

export function DevelopersProducts() {
  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-3 font-inter text-[13px] text-muted-foreground">
            Products
          </p>
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Everything you need to ship AI.
        </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            From your first model call to the systems behind your entire AI
            product.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => {
            const isSpan = "span" in product && product.span;
            const isTall = "tall" in product && product.tall;
            const isWhite = "white" in product && product.white;
            const isSquare = "square" in product && product.square;
            const isTile = "tile" in product && product.tile;
            const hasImage = "image" in product && product.image;
            const desktopOrder =
              product.href === "/ai-gateway"
                ? "lg:order-0"
                : isWhite
                  ? "lg:order-1"
                  : product.href === "/memory"
                    ? "lg:order-2"
                    : product.href === "/compute"
                      ? "lg:order-3"
                      : product.href === "/arcie"
                        ? "lg:order-4"
                        : "lg:order-5";
            return (
            <Link
              className={`group overflow-hidden rounded-2xl border transition-colors ${isTall ? "max-sm:aspect-auto" : "max-sm:aspect-square"} ${desktopOrder}${
                isSquare
                  ? "border-white/10 bg-black hover:border-white/40"
                  : isWhite
                    ? "border-white/10 hover:border-white/40"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
              }${isSpan ? " lg:col-span-2" : ""}${isTall ? " lg:row-span-2" : ""}${isSquare ? " aspect-square" : ""}${isTile ? " lg:aspect-square" : ""}`}
              href={product.href}
              key={product.href}
            >
              {hasImage ? (
                <div
                  className={`relative h-full min-h-80 overflow-hidden max-sm:min-h-0 ${
                    "contain" in product && product.contain
                      ? "light" in product && product.light
                        ? "bg-black"
                        : "bg-white"
                      : product.href === "/ai-gateway"
                        ? "bg-white"
                        : ""
                  }`}
                >
                  {product.href === "/basecode" ? (
                    <>
                      <Image
                        alt={product.name}
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03] max-sm:hidden"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw"
                        src={product.image}
                      />
                      <Image
                        alt={product.name}
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:hidden"
                        fill
                        sizes="100vw"
                        src="/bcmob.png"
                      />
                    </>
                  ) : (
                    <Image
                      alt={product.name}
                      className={`transition-transform duration-300 group-hover:scale-[1.03] ${
                        "contain" in product && product.contain
                          ? "object-contain p-14"
                          : product.href === "/ai-gateway"
                            ? "object-cover max-sm:object-contain max-sm:p-12"
                            : "object-cover"
                      }`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw"
                      src={product.image}
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
                    <h3
                      className={`text-base font-semibold tracking-tight ${
                        "light" in product && product.light
                          ? "text-white"
                          : "text-black"
                      }`}
                    >
                      {product.name}
                    </h3>
                    <span
                      className={`inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full pr-3 pl-4 text-[13px] font-semibold ${
                        "light" in product && product.light
                          ? "bg-white text-black"
                          : "bg-black text-white"
                      }`}
                    >
                      Explore
                      <ChevronRight className="size-4" strokeWidth={2.2} />
                    </span>
                  </div>
                </div>
              ) : isWhite ? (
                <div className="relative flex h-full min-h-64 flex-col justify-center overflow-hidden bg-white p-6 pt-20 pb-16 max-sm:min-h-0">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse 130% 90% at 50% 115%, rgba(46, 13, 184, 0.62) 0%, rgba(106, 20, 224, 0.42) 22%, rgba(194, 43, 176, 0.32) 38%, rgba(240, 68, 30, 0.26) 52%, rgba(255, 255, 255, 0) 70%)",
                    }}
                  />
                  <span className="absolute top-6 right-6 z-10 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-black pr-3 pl-4 text-[13px] font-semibold text-white">
                    Explore
                    <ChevronRight className="size-4" strokeWidth={2.2} />
                  </span>
                  <div className="relative z-10 m-auto w-full rounded-xl border border-black/10 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="grid size-7 place-items-center rounded-lg bg-black/[0.04]">
                        <Building2 className="size-4 text-black/70" strokeWidth={1.8} />
                      </div>
                      <p className="text-[13px] font-semibold text-black">
                        Acme corp
                      </p>
                    </div>
                    <div className="-mx-4 border-t border-black/10" />
                    <div className="mt-3 flex items-center justify-between text-[13px]">
                      <span className="text-black/50">Provider cost</span>
                      <span className="font-medium text-black tabular-nums">$535.00</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-black/50">Revenue</span>
                      <span className="font-medium text-black tabular-nums">$896.63</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-black/50">Tokens</span>
                      <span className="font-medium text-black tabular-nums">23,400,000</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-black/50">Top Model</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-black tabular-nums">
                        <Image
                          alt="OpenAI"
                          className="text-black"
                          height={14}
                          src="/openai.svg"
                          width={14}
                        />
                        GPT-6-Astra
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-black/50">User ID</span>
                      <span className="font-medium text-black tabular-nums">G9B-E2K</span>
                    </div>
                    <div className="-mx-4 my-3 border-t border-black/10" />
                    <div className={`${styles.chart} flex h-36 items-end gap-1`}>
                      {[
                        { h: 42, green: 55, orange: 45 },
                        { h: 68, green: 70, orange: 30 },
                        { h: 35, green: 40, orange: 60 },
                        { h: 88, green: 85, orange: 15 },
                        { h: 58, green: 60, orange: 40 },
                        { h: 76, green: 75, orange: 25 },
                        { h: 50, green: 50, orange: 50 },
                        { h: 92, green: 80, orange: 20 },
                        { h: 38, green: 45, orange: 55 },
                        { h: 64, green: 65, orange: 35 },
                        { h: 82, green: 72, orange: 28 },
                        { h: 48, green: 52, orange: 48 },
                        { h: 71, green: 68, orange: 32 },
                        { h: 30, green: 35, orange: 65 },
                        { h: 95, green: 88, orange: 12 },
                        { h: 56, green: 58, orange: 42 },
                        { h: 78, green: 74, orange: 26 },
                        { h: 44, green: 48, orange: 52 },
                        { h: 86, green: 82, orange: 18 },
                        { h: 62, green: 62, orange: 38 },
                        { h: 74, green: 70, orange: 30 },
                        { h: 40, green: 42, orange: 58 },
                        { h: 84, green: 78, orange: 22 },
                        { h: 52, green: 54, orange: 46 },
                        { h: 90, green: 84, orange: 16 },
                        { h: 36, green: 38, orange: 62 },
                        { h: 66, green: 64, orange: 36 },
                        { h: 80, green: 76, orange: 24 },
                        { h: 58, green: 56, orange: 44 },
                      ].map((bar, i) => (
                        <div
                          className={`${styles.bar} flex-1 overflow-hidden`}
                          key={i}
                          style={{
                            height: `${bar.h}%`,
                          }}
                        >
                          <div
                            className="bg-[#4fb583]"
                            style={{ height: `${bar.green}%` }}
                          />
                          <div
                            className="bg-[#e8a15e]"
                            style={{ height: `${bar.orange}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <h3 className="absolute bottom-6 left-6 z-10 text-base font-semibold tracking-tight text-black">
                    Monetization
                  </h3>
                </div>
              ) : isSquare ? (
                <div className="flex h-full flex-col p-6">
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <ArcieChatSim />
                  </div>
                  <h3 className="pt-4 text-base font-semibold tracking-tight text-white">
                    {product.name} <span className="font-normal text-white/50">— Agent Framework</span>
                  </h3>
                </div>
              ) : (
                <div className="p-6">
                  {"icon" in product && product.icon ? (
                    <div className="mb-5 grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                      <product.icon className="size-5 text-white/80" strokeWidth={1.8} />
                    </div>
                  ) : null}
                  <h3 className="mb-2 text-base font-semibold tracking-tight">
                    {product.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              )}
            </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
