"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { AIGatewayDiagram } from "./diagrams/AIGatewayDiagram";
import { ComputeDiagram } from "./diagrams/ComputeDiagram";
import { WorkflowDiagram } from "./diagrams/WorkflowDiagram";
import { IntegrationDiagram } from "./diagrams/IntegrationDiagram";
import { DataStorageDiagram } from "./diagrams/DataStorageDiagram";

type TabKey = "gateway" | "compute" | "workflow" | "integration" | "storage";

interface Tab {
    key: TabKey;
    label: string;
    icon: React.ReactNode;
}

const tabs: Tab[] = [
    {
        key: "gateway",
        label: "AI Gateway",
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
            </svg>
        )
    },
    {
        key: "compute",
        label: "Compute",
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M9 9h6v6H9z" />
            </svg>
        )
    },
    {
        key: "workflow",
        label: "Workflow",
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h4l3-9 4 18 3-9h4" />
            </svg>
        )
    },
    {
        key: "integration",
        label: "Integration",
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
        )
    },
    {
        key: "storage",
        label: "Data Storage",
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
            </svg>
        )
    },
];

export const InfrastructureTabs = () => {
    const [activeTab, setActiveTab] = useState<TabKey>("gateway");

    const renderTabContent = () => {
        switch (activeTab) {
            case "gateway":
                return <AIGatewayDiagram />;
            case "compute":
                return <ComputeDiagram />;
            case "workflow":
                return <WorkflowDiagram />;
            case "integration":
                return <IntegrationDiagram />;
            case "storage":
                return <DataStorageDiagram />;
            default:
                return null;
        }
    };

    return (
        <div className="w-full">
            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/50">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                activeTab === tab.key
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content - Sharp corners with + markers */}
            <div className="relative border border-border bg-background">
                {/* Background dot grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.10]"
                    style={{
                        backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
                        backgroundSize: '24px 24px',
                    }}
                />

                {/* Corner markers - positioned at the corners */}
                <div className="absolute -top-3 -left-3 w-6 h-6 flex items-center justify-center bg-background text-muted-foreground text-xl font-light z-20">+</div>
                <div className="absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center bg-background text-muted-foreground text-xl font-light z-20">+</div>
                <div className="absolute -bottom-3 -left-3 w-6 h-6 flex items-center justify-center bg-background text-muted-foreground text-xl font-light z-20">+</div>
                <div className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center bg-background text-muted-foreground text-xl font-light z-20">+</div>

                {/* Content area */}
                <div className="relative z-[1] p-8 min-h-[550px]">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};
