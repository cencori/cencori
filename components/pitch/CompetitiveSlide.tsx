import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchTable } from "./PitchPrimitives";

const headers = ["Company", "AI Gateway", "Compute", "Billing", "Full Stack", "Africa-Native"];

const data = [
    ["OpenRouter", "✓", "✗", "✗", "✗", "✗"],
    ["Portkey", "✓", "✗", "✗", "✗", "✗"],
    ["LiteLLM", "✓", "✗", "✗", "✗", "✗"],
    ["AWS Bedrock", "✓", "✓", "✗", "Partial", "✗"],
    ["CoreWeave", "✗", "✓", "✗", "✗", "✗"],
    ["Cencori", "✓", "✓", "✓", "✓", "✓"],
];

export function CompetitiveSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Competition"
                title="Nobody has the full stack. Nobody is building for Africa. Nobody has native end-user billing."
                subtitle="Those three intersections are Cencori’s moat."
            />

            <div className="flex flex-1 flex-col justify-between">
                <div className="pt-2">
                    <PitchTable 
                        headers={headers}
                        rows={data.map(row => 
                            row.map((cell, i) => (
                                <span 
                                    key={i} 
                                    className={row[0] === "Cencori" ? "text-foreground font-semibold" : "text-muted-foreground/70"}
                                >
                                    {cell}
                                </span>
                            ))
                        )}
                    />
                </div>

                <PitchQuote>
                    The deeper moat is switching cost. A team that builds on Cencori's gateway, runs compute on Cencori, and bills their users through Cencori is not switching.
                </PitchQuote>
            </div>
        </PitchSlide>
    );
}
