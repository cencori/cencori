"use client";

/**
 * An integration's own page: /settings/integrations/<slug> on the console
 * (/{org}/{project}/settings/integrations/<slug> elsewhere). The Integrations tab lists cards;
 * everything about one connection — details, sending, reconnect, disconnect — lives here.
 */

import { use } from "react";
import { notFound } from "next/navigation";
import { CostGraphIntegrationPage } from "@/components/finops/CostGraphIntegration";

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string; integration: string }>;
}

export default function IntegrationPage({ params }: PageProps) {
    const { orgSlug, integration } = use(params);

    switch (integration) {
        case "costgraph":
            return <CostGraphIntegrationPage orgSlug={orgSlug} />;
        default:
            notFound();
    }
}
