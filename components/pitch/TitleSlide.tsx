import React from "react";
import Image from "next/image";

export function TitleSlide() {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 md:p-16 relative overflow-hidden bg-card">
            {/* Subtle grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: "40px 40px",
                }}
            />

            {/* Content */}
            <div className="relative z-10 text-center space-y-8">
                {/* Logo/Brand */}
                <div className="flex items-center justify-center">
                    <Image
                        src="/cdark.png"
                        alt="Cencori"
                        width={240}
                        height={60}
                        className="h-14 w-auto"
                        priority
                        unoptimized
                    />
                </div>

                {/* Tagline */}
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight max-w-4xl leading-tight">
                    The Infrastructure{" "}
                    <span className="italic font-normal text-muted-foreground">for</span>{" "}
                    <span className="text-emerald-500">AI Production</span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Ship AI with built-in security, observability, and scale.
                    <br className="hidden md:block" />
                    One platform for everything.
                </p>

                {/* Company info */}
                <div className="pt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                    <span>FohnAI Inc.</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                    <span>2026</span>
                </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-muted-foreground/50">
                <span className="w-8 h-px bg-muted-foreground/30" />
                <span>CONFIDENTIAL</span>
                <span className="w-8 h-px bg-muted-foreground/30" />
            </div>
        </div>
    );
}
