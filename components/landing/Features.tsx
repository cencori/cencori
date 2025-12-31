import React from "react";
import { BentoGrid, BentoGridCell } from "./bento/BentoGrid";
import {
    UnifiedProxyCard,
    RealTimeMetricsCard,
    ModelRouterCard,
    RequestPipelineCard,
    LatencyOverheadCard,
    GlobalEdgeCard,
    UnifiedBillingCard,
} from "./bento";

export const Features = () => {
    return (
        <section className="py-20 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center text-center mb-12">
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                        Everything you need to{" "}
                        <span className="text-muted-foreground">ship AI</span>
                    </h2>
                    <p className="text-base text-muted-foreground max-w-xl">
                        A complete platform to build, secure, and scale AI features.
                        Connect once, use any provider.
                    </p>
                </div>

                <div className="max-w-6xl mx-auto">
                    <BentoGrid>
                        {/* Row 1-2: Unified Proxy (2x2) */}
                        <BentoGridCell colSpan={2} rowSpan={2} className="min-h-[420px]">
                            <UnifiedProxyCard />
                        </BentoGridCell>

                        {/* Row 1 right side: Real-time Metrics (2x1) */}
                        <BentoGridCell colSpan={2} className="min-h-[200px]">
                            <RealTimeMetricsCard />
                        </BentoGridCell>

                        {/* Row 2 right side: Model Router + Unified Billing */}
                        <BentoGridCell className="min-h-[200px]">
                            <ModelRouterCard />
                        </BentoGridCell>
                        <BentoGridCell className="min-h-[200px]">
                            <UnifiedBillingCard />
                        </BentoGridCell>

                        {/* Row 3: Request Pipeline + Latency Overhead + Global Edge */}
                        <BentoGridCell className="min-h-[200px]">
                            <RequestPipelineCard />
                        </BentoGridCell>
                        <BentoGridCell colSpan={2} className="min-h-[200px]">
                            <LatencyOverheadCard />
                        </BentoGridCell>
                        <BentoGridCell className="min-h-[200px]">
                            <GlobalEdgeCard />
                        </BentoGridCell>
                    </BentoGrid>
                </div>
            </div>
        </section>
    );
};
