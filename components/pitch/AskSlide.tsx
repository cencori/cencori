import React from "react";
import { 
    PitchHeader, 
    PitchMeta, 
    PitchNumber, 
    PitchSlide, 
    PitchTable 
} from "./PitchPrimitives";

const useOfFunds = [
    {
        area: "Engineering",
        share: "50%",
        amount: "$1.5M",
        focus: "Backend, Infra, Reliability hires",
    },
    {
        area: "Infra & Compute",
        share: "20%",
        amount: "$600K",
        focus: "GPU Provisioning, Redundancy",
    },
    {
        area: "Go-to-Market",
        share: "20%",
        amount: "$600K",
        focus: "Dev Marketing, Africa Activation",
    },
    {
        area: "Ops & Overhead",
        share: "10%",
        amount: "$300K",
        focus: "Legal, Finance, Tooling",
    },
];

const milestones = [
    { label: "Revenue", value: "$1M ARR", time: "Month 16" },
    { label: "Adoption", value: "200 Paying Teams", time: "Month 12" },
    { label: "Product", value: "Compute Public Beta", time: "Month 6" },
    { label: "Exit/Next", value: "Series A Ready", time: "Month 20" },
];

export function AskSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The ask"
                title="Raising $3,000,000 to turn product proof into infrastructure scale."
                subtitle="Fuel for the next 20 months of growth and category ownership."
            />

            <div className="grid flex-1 gap-12 md:grid-cols-[0.8fr_1.2fr]">
                <div className="flex flex-col justify-between py-4">
                    <div className="grid gap-10">
                        <PitchNumber label="Raise" value="$3,000,000" note="Seed Round / Equity & SAFE" />
                        <PitchNumber label="Pre-money Valuation" value="$18,000,000" />
                        <PitchNumber label="Runway" value="20 Months" />
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                                Contact
                            </p>
                            <p className="text-xl font-medium text-foreground">bola@cencori.com</p>
                            <p className="text-lg text-muted-foreground">cencori.com</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-12 py-4">
                    <div className="space-y-6">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                            Use of funds
                        </p>
                        <PitchTable 
                            headers={["Area", "%", "Amount", "Focus"]}
                            rows={useOfFunds.map(f => [
                                f.area,
                                f.share,
                                <span key={f.area} className="text-foreground font-semibold">{f.amount}</span>,
                                <span key={f.area + "f"} className="text-muted-foreground/70">{f.focus}</span>
                            ])}
                        />
                    </div>

                    <div className="space-y-6">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                            Key Milestones
                        </p>
                        <div className="grid grid-cols-2 gap-8">
                            {milestones.map(m => (
                                <PitchMeta 
                                    key={m.label} 
                                    label={`${m.label} • ${m.time}`} 
                                    value={m.value} 
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </PitchSlide>
    );
}
