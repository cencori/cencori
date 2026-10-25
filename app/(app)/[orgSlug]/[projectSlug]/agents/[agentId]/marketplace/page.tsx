"use client";

import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { MarketplaceBrowser } from "@/components/dashboard/embedded-agents/MarketplaceBrowser";

export default function AgentMarketplacePage() {
    const { projectId, data, canManage } = useAgentWorkspace();
    return (
        <div>
            <header className="mb-6">
                <h1 className="text-base font-medium">Marketplace</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Public agents you can fork into this project or install for a customer.</p>
            </header>
            <MarketplaceBrowser projectId={projectId} tenants={data.tenants} canManage={canManage} />
        </div>
    );
}
