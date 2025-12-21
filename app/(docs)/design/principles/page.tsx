import React from "react";
import { CheckCircle, XCircle } from "lucide-react";

export const metadata = {
    title: "Principles | Cenpact",
    description: "Core design philosophy of the Cenpact design system",
};

const principles = [
    {
        title: "Dense but Breathable",
        description: "Pack information tightly while maintaining visual hierarchy through whitespace. Every pixel should earn its place, but never at the cost of clarity.",
        dos: [
            "Use tight spacing within components",
            "Maintain generous margins between sections",
            "Rely on visual hierarchy over spacing",
        ],
        donts: [
            "Cramming elements without rhythm",
            "Using uniform spacing everywhere",
            "Sacrificing readability for density",
        ],
    },
    {
        title: "Subtle Sophistication",
        description: "Prefer muted colors, soft borders, and understated hover effects. Let the content shine, not the chrome.",
        dos: [
            "Use border-border/50 for soft separation",
            "Apply hover effects that enhance, not distract",
            "Choose muted accent colors",
        ],
        donts: [
            "Bold, attention-grabbing UI elements",
            "Harsh color contrasts for decoration",
            "Overusing animations or transitions",
        ],
    },
    {
        title: "Developer-First",
        description: "Design for power users who value efficiency over hand-holding. Optimize for keyboard navigation and information density.",
        dos: [
            "Provide keyboard shortcuts where possible",
            "Show technical details (IDs, timestamps)",
            "Enable bulk actions and quick filters",
        ],
        donts: [
            "Hiding useful information behind clicks",
            "Dumbing down interfaces for 'simplicity'",
            "Forcing multi-step wizards for simple tasks",
        ],
    },
    {
        title: "Dark Mode Native",
        description: "Design in dark mode first, then adapt for light. The dark experience is never an afterthought.",
        dos: [
            "Test dark mode before light mode",
            "Use semantic color tokens",
            "Ensure sufficient contrast in both modes",
        ],
        donts: [
            "Adding dark mode as an afterthought",
            "Using raw color values (white, black)",
            "Assuming light mode is the default",
        ],
    },
];

export default function PrinciplesPage() {
    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Principles</h1>
                <p className="text-sm text-muted-foreground max-w-2xl">
                    The foundational philosophy behind every Cenpact design decision.
                </p>
            </div>

            {/* Principles */}
            <div className="space-y-8">
                {principles.map((principle, index) => (
                    <section
                        key={principle.title}
                        className="rounded-xl border border-border/50 bg-card overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border/40">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-muted-foreground">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <h2 className="text-base font-semibold">{principle.title}</h2>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 max-w-xl">
                                {principle.description}
                            </p>
                        </div>

                        {/* Do's and Don'ts */}
                        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/40">
                            {/* Do's */}
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    <span className="text-xs font-medium text-emerald-500">Do</span>
                                </div>
                                <ul className="space-y-2">
                                    {principle.dos.map((item) => (
                                        <li key={item} className="text-xs text-muted-foreground flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">•</span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Don'ts */}
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-xs font-medium text-red-500">Don't</span>
                                </div>
                                <ul className="space-y-2">
                                    {principle.donts.map((item) => (
                                        <li key={item} className="text-xs text-muted-foreground flex items-start gap-2">
                                            <span className="text-red-500 mt-0.5">•</span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
