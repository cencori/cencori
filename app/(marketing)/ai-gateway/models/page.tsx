import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ModelCatalog } from "@/components/models/ModelCatalog";
import { Button } from "@/components/ui/button";
import { SUPPORTED_PROVIDERS } from "@/lib/providers/config";
import { buildOgImageUrl } from "@/lib/og";
import { getConsoleUrl } from "@/lib/auth-redirect";

const modelsOgImage = buildOgImageUrl({
    title: "AI Models",
    subtitle: "Browse every model on Cencori's unified API",
    type: "docs",
});

export const metadata: Metadata = {
    title: "AI Models",
    description: `Browse ${SUPPORTED_PROVIDERS.reduce((acc, p) => acc + p.models.length, 0)}+ AI models from ${SUPPORTED_PROVIDERS.length} providers available through Cencori. Search, filter, and compare models from OpenAI, Anthropic, Google, Mistral, and more.`,
    openGraph: {
        title: "AI Models | Cencori",
        description: "Browse all AI models available through Cencori's unified API.",
        type: "website",
        images: [
            {
                url: modelsOgImage,
                width: 1200,
                height: 630,
            },
        ],
    },
};

export default function ModelsPage() {
    // Nav + footer + dark scope come from the marketing shell.
    return (
        <>
            {/* Hero — same treatment as /developers, compact so the catalog sits high */}
            <section className="relative flex items-center justify-center overflow-hidden px-4 pt-44 pb-14 sm:pt-56 sm:pb-16">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 hidden h-[620px] sm:block"
                    style={{
                        background:
                            "radial-gradient(ellipse 55% 65% at 50% -8%, rgba(216, 205, 255, 0.95) 0%, rgba(150, 124, 255, 0.5) 32%, rgba(88, 62, 190, 0.18) 55%, transparent 75%)",
                    }}
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-[520px] sm:hidden"
                    style={{
                        background:
                            "radial-gradient(ellipse 95% 60% at 50% -8%, rgba(216, 205, 255, 0.95) 0%, rgba(150, 124, 255, 0.5) 35%, rgba(88, 62, 190, 0.18) 60%, transparent 78%)",
                    }}
                />
                <div className="relative z-10 mx-auto max-w-6xl text-center">
                    <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                        AI Models
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                        Explore, discover and compare leading AI models.
                    </p>
                    <div className="mt-8 flex flex-row items-center justify-center gap-3">
                        <Button
                            asChild
                            className="group h-10 rounded-full pr-2 pl-5 text-sm font-semibold"
                        >
                            <Link href={getConsoleUrl("/signup")}>
                                Get API key
                                <HugeiconsIcon
                                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                                    color="currentColor"
                                    icon={ArrowRight01Icon}
                                    size={14}
                                    strokeWidth={1.9}
                                />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            className="h-10 rounded-full px-5 text-sm font-semibold"
                            variant="outline"
                        >
                            <Link href="/docs">Read the docs</Link>
                        </Button>
                    </div>
                </div>
            </section>

            <div className="mx-auto px-4 sm:px-8 w-full pt-32 pb-8 sm:pb-12">
                {/* Catalog */}
                <ModelCatalog />
            </div>
        </>
    );
}
