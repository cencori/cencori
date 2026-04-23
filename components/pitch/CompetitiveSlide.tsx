import React from "react";
import { PitchHeader, PitchQuote, PitchSlide } from "./PitchPrimitives";

const data = [
    ["OpenRouter", "Yes", "No", "No", "No", "No"],
    ["Portkey", "Yes", "No", "No", "No", "No"],
    ["LiteLLM", "Yes", "No", "No", "No", "No"],
    ["AWS Bedrock", "Yes", "Yes", "No", "Partial", "No"],
    ["CoreWeave", "No", "Yes", "No", "No", "No"],
    ["Cencori", "Yes", "Yes", "Yes", "Yes", "Yes"],
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
                <div className="overflow-hidden border-t border-white/10 pt-4">
                    <table className="w-full table-fixed border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                                <th className="pb-3 pr-3 font-medium">Company</th>
                                <th className="pb-3 pr-3 font-medium">AI gateway</th>
                                <th className="pb-3 pr-3 font-medium">Compute</th>
                                <th className="pb-3 pr-3 font-medium">Billing</th>
                                <th className="pb-3 pr-3 font-medium">Full stack</th>
                                <th className="pb-3 font-medium">Africa-native</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {data.map((row) => (
                                <tr
                                    key={row[0]}
                                    className={`border-b border-white/10 last:border-b-0 ${
                                        row[0] === "Cencori" ? "text-white" : "text-zinc-500"
                                    }`}
                                >
                                    {row.map((cell, index) => (
                                        <td
                                            key={`${row[0]}-${index}`}
                                            className={`py-3 pr-3 ${
                                                index === 0 ? "font-medium" : ""
                                            }`}
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <PitchQuote>
                    The deeper moat is switching cost. A team that routes through
                    Cencori, runs compute on Cencori, and bills through Cencori is not
                    switching easily.
                </PitchQuote>
            </div>
        </PitchSlide>
    );
}
