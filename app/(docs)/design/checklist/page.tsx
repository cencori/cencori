import React from "react";
import { CheckCircle, Circle } from "lucide-react";

export const metadata = {
    title: "Design Review Checklist | Cenpact",
    description: "Pre-ship checklist for design review",
};

const checklist = [
    {
        category: "Visual Quality",
        items: [
            "Tested in both dark and light modes",
            "Responsive at all breakpoints (mobile, tablet, desktop)",
            "Consistent spacing (follows space-y-* system)",
            "Typography follows scale (no ad-hoc sizes)",
            "Colors use semantic tokens (no raw values)",
        ],
    },
    {
        category: "Interaction",
        items: [
            "All interactive elements have hover states",
            "Focus states are visible (focus-visible:ring)",
            "Loading states implemented (skeletons, spinners)",
            "Empty states designed (no data scenarios)",
            "Error states handled gracefully",
        ],
    },
    {
        category: "Accessibility",
        items: [
            "Keyboard navigable (Tab, Enter, Escape)",
            "Color contrast passes WCAG AA (4.5:1)",
            "Icon-only buttons have aria-label",
            "Form inputs have associated labels",
            "Status indicators have text alternatives",
        ],
    },
    {
        category: "Performance",
        items: [
            "Images optimized (WebP, compressed)",
            "No layout shift on load (CLS)",
            "Heavy components lazy loaded",
            "No unnecessary re-renders",
            "Appropriate staleTime for API calls",
        ],
    },
    {
        category: "Code Quality",
        items: [
            "Follows component structure pattern",
            "Uses React Query for data fetching",
            "No inline styles (use Tailwind classes)",
            "No magic numbers (use design tokens)",
            "Consistent naming conventions",
        ],
    },
];

export default function ChecklistPage() {
    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Design Review Checklist</h1>
                <p className="text-sm text-muted-foreground max-w-2xl">
                    Review this checklist before shipping any UI changes.
                </p>
            </div>

            {/* Checklist */}
            <div className="space-y-6">
                {checklist.map((section) => (
                    <section
                        key={section.category}
                        className="rounded-xl border border-border/50 bg-card overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
                            <h2 className="text-sm font-semibold">{section.category}</h2>
                        </div>
                        <div className="divide-y divide-border/40">
                            {section.items.map((item) => (
                                <label
                                    key={item}
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                >
                                    <input type="checkbox" className="sr-only peer" />
                                    <Circle className="h-4 w-4 text-muted-foreground peer-checked:hidden" />
                                    <CheckCircle className="h-4 w-4 text-emerald-500 hidden peer-checked:block" />
                                    <span className="text-xs peer-checked:line-through peer-checked:text-muted-foreground">
                                        {item}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {/* Summary */}
            <section className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center">
                <h3 className="text-sm font-semibold mb-2">Ready to ship?</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Once you've checked all items, your changes are ready for review.
                    Remember: it's easier to catch issues now than after deployment.
                </p>
            </section>
        </div>
    );
}
