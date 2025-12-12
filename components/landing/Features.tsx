import React from "react";
import {
    UnifiedProxyCard,
    RealTimeMetricsCard,
    ModelRouterCard,
    RequestPipelineCard,
    LatencyOverheadCard,
    GlobalEdgeCard,
} from "./bento";

export const Features = () => {
    return (
        <section className="py-32 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center text-center mb-20">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-6 text-white">
                        Everything you need to{" "}
                        <span className="text-white/60">ship AI</span>
                    </h2>
                    <p className="text-lg text-white/50 max-w-2xl">
                        A complete platform to build, secure, and scale AI features.
                        Connect once, use any provider.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 max-w-6xl mx-auto">
                    {/* Row 1: Unified Proxy (2x2) + Real-time Metrics (2x1) + Model Router start */}
                    <div className="md:col-span-2 md:row-span-2 min-h-[420px]">
                        <UnifiedProxyCard />
                    </div>
                    <div className="md:col-span-2 min-h-[200px]">
                        <RealTimeMetricsCard />
                    </div>

                    {/* Row 2: Model Router (spanning into row 2) */}
                    <div className="md:col-span-1 md:row-span-2 min-h-[420px]">
                        <ModelRouterCard />
                    </div>

                    {/* Request Pipeline next to Model Router */}
                    <div className="md:col-span-1 min-h-[200px]">
                        <RequestPipelineCard />
                    </div>

                    {/* Row 3: Latency Overhead + Global Edge */}
                    <div className="md:col-span-2 min-h-[200px]">
                        <LatencyOverheadCard />
                    </div>
                    <div className="md:col-span-1 min-h-[200px]">
                        <GlobalEdgeCard />
                    </div>
                </div>
            </div>
        </section>
    );
};

