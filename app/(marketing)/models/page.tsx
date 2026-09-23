import type { Metadata } from "next";
import Link from "next/link";
import { ModelCatalog } from "@/components/models/ModelCatalog";
import { SUPPORTED_PROVIDERS } from "@/lib/providers/config";

export const metadata: Metadata = {
  title: "Models — Every text model on Cencori's unified API",
  description:
    "Browse every chat, reasoning, code and image model available through Cencori today. Training, fine-tuning and hosting are still on the roadmap.",
};

export default function ModelsPage() {
  const totalModels = SUPPORTED_PROVIDERS.reduce((acc, p) => acc + p.models.length, 0);
  const totalProviders = SUPPORTED_PROVIDERS.length;

  // Nav + footer come from the marketing shell (developers-style scroll nav).
  return (
    <div className="container mx-auto px-4 max-w-6xl py-8 sm:py-12 pt-20">
      <div className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
          Available today
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          Models
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
          Browse {totalModels}+ models from {totalProviders} providers. All accessible through a single API with built-in security, observability, and failover.
        </p>
        <p className="text-sm text-muted-foreground/70 mt-3 max-w-2xl">
          Looking for training, fine-tuning, evaluation or hosting? Those are model infrastructure on the roadmap —{" "}
          <Link href="/ai/models" className="underline underline-offset-4 hover:text-foreground">
            the live text-model catalog lives here
          </Link>
          .
        </p>
      </div>

      <ModelCatalog />
    </div>
  );
}
