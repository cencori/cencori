import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchTable } from "./PitchPrimitives";

const headers = ["Feature", "Point Solutions", "Big Tech (AWS/GCP)", "Cencori"];

const data = [
    ["Unified Gateway", "✓", "Limited", "✓"],
    ["GPU Compute", "✗", "✓", "✓"],
    ["End-User Billing", "✗", "✗", "✓"],
    ["Africa Infrastructure", "✗", "✗", "✓"],
    ["Full-Stack Ownership", "✗", "Partial", "✓"],
];

export function CompetitiveSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Competition"
                title="A category of one."
                subtitle="Nobody has the full stack. Nobody has native billing. Nobody is building for Africa."
            />

            <PitchTable 
                headers={headers}
                rows={data}
            />

            <PitchQuote>
                The deepest moat is switching cost. Once a team integrates our billing and compute, we become their vital organs.
            </PitchQuote>
        </PitchSlide>
    );
}
