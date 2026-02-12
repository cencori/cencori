import { Metadata } from "next";
import { AuthNavbar } from "@/components/landing/AuthNavbar";
import { Footer } from "@/components/landing/Footer";
import { ModelCatalog } from "@/components/models/ModelCatalog";
import { SUPPORTED_PROVIDERS } from "@/lib/providers/config";

export const metadata: Metadata = {
    title: "AI Models",
    description: `Browse ${SUPPORTED_PROVIDERS.reduce((acc, p) => acc + p.models.length, 0)}+ AI models from ${SUPPORTED_PROVIDERS.length} providers available through Cencori. Search, filter, and compare models from OpenAI, Anthropic, Google, Mistral, and more.`,
    openGraph: {
        title: "AI Models | Cencori",
        description: "Browse all AI models available through Cencori's unified API.",
        type: "website",
        images: [
            {
                url: `/api/og?title=${encodeURIComponent("AI Models")}&subtitle=${encodeURIComponent("Browse 80+ models from 14 providers")}&type=docs`,
                width: 1200,
                height: 630,
            },
        ],
    },
};

export default function ModelsPage() {
    const totalModels = SUPPORTED_PROVIDERS.reduce((acc, p) => acc + p.models.length, 0);
    const totalProviders = SUPPORTED_PROVIDERS.length;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <AuthNavbar />

            <main className="flex-1 pt-20">
                <div className="container mx-auto px-4 max-w-6xl py-12">
                    {/* Header */}
                    <div className="mb-10">
                        <h1 className="text-3xl font-bold tracking-tight mb-3">
                            AI Models
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl">
                            Browse {totalModels}+ models from {totalProviders} providers. All accessible through a single API with built-in security, observability, and failover.
                        </p>
                    </div>

                    {/* Catalog */}
                    <ModelCatalog />
                </div>
            </main>

            <Footer />
        </div>
    );
}
