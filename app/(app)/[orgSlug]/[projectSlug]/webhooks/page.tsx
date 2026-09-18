"use client";

import { use } from "react";
import { WebhooksManager } from "@/components/dashboard/WebhooksManager";

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function WebhooksPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);

    return (
        <div className="w-full max-w-4xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-lg font-semibold">Webhooks</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Send real-time notifications to your endpoints when events occur
                </p>
            </div>
            <WebhooksManager orgSlug={orgSlug} projectSlug={projectSlug} />
        </div>
    );
}
