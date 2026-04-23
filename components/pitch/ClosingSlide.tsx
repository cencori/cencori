import React from "react";
import { PitchHeader, PitchMeta, PitchQuote, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const eras = [
    {
        title: "Mainframe era",
        description: "IBM",
    },
    {
        title: "Internet era",
        description: "AWS",
    },
    {
        title: "Mobile era",
        description: "Twilio and Stripe",
    },
];

export function ClosingSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Closing"
                title="Every era of computing creates one infrastructure company that becomes indispensable."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[0.9fr_1.1fr]">
                <div>
                    <PitchRuleList items={eras} />
                </div>

                <div className="flex flex-col justify-between">
                    <PitchQuote>
                        The intelligence era is going to be Cencori.
                    </PitchQuote>

                    <div className="border-t border-white/10 pt-4">
                        <p className="text-sm leading-6 text-zinc-500 md:text-[15px]">
                            The infrastructure that powers the next generation of
                            intelligent products, software, hardware, robotics, and
                            frontier models has not been built. Cencori is building it.
                        </p>
                    </div>

                    <div className="grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
                        <PitchMeta label="Contact" value="Bola Banjo — bola@cencori.com" />
                        <PitchMeta label="Website" value="cencori.com" />
                    </div>
                </div>
            </div>
        </PitchSlide>
    );
}
