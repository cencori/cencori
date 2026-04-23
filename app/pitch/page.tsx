"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

import { PITCH_SLIDES as slides } from "@/lib/pitch-slides";

export default function PitchDeckPage() {
    const [currentSlide, setCurrentSlide] = useState(0);

    const goToSlide = useCallback((index: number) => {
        if (index >= 0 && index < slides.length) {
            setCurrentSlide(index);
        }
    }, []);

    const nextSlide = useCallback(() => {
        goToSlide(currentSlide + 1);
    }, [currentSlide, goToSlide]);

    const prevSlide = useCallback(() => {
        goToSlide(currentSlide - 1);
    }, [currentSlide, goToSlide]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                nextSlide();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prevSlide();
            } else if (e.key === "Home") {
                e.preventDefault();
                goToSlide(0);
            } else if (e.key === "End") {
                e.preventDefault();
                goToSlide(slides.length - 1);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [nextSlide, prevSlide, goToSlide]);

    const CurrentSlideComponent = slides[currentSlide].component;

    return (
        <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
            {/* Slide Content */}
            <div className="flex flex-1 items-center justify-center px-4 py-6 md:px-8 md:py-10">
                <div className="aspect-[32/21] w-full max-w-6xl overflow-hidden bg-background">
                    <CurrentSlideComponent />
                </div>
            </div>

            {/* Navigation Controls */}
            <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-5 bg-background/96 px-4 py-3 backdrop-blur-sm">
                <button
                    type="button"
                    className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground disabled:text-muted-foreground"
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                >
                    Previous
                </button>

                <div className="flex items-center gap-2">
                    {slides.map((slide, index) => (
                        <button
                            key={slide.id}
                            onClick={() => goToSlide(index)}
                            className={cn(
                                "text-[11px] uppercase tracking-[0.2em] transition-colors",
                                index === currentSlide
                                    ? "text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                        >
                            {String(index + 1).padStart(2, "0")}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground disabled:text-muted-foreground"
                    onClick={nextSlide}
                    disabled={currentSlide === slides.length - 1}
                >
                    Next
                </button>
            </div>

            {/* Slide Counter */}
            <div className="fixed bottom-6 right-6 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                {String(currentSlide + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </div>

            {/* Keyboard Hint */}
            <div className="fixed bottom-6 left-6 hidden text-[11px] uppercase tracking-[0.24em] text-muted-foreground md:block">
                Use ← → or Space to navigate
            </div>
        </div>
    );
}
