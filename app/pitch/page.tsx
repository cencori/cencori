"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
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
        <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col">
            {/* Slide Content */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-12">
                <div className="w-full max-w-6xl aspect-[16/9] bg-card rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
                    <CurrentSlideComponent />
                </div>
            </div>

            {/* Navigation Controls */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-card/90 backdrop-blur-md rounded-full border border-border/50 px-4 py-2 shadow-lg">
                {/* Previous Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                </Button>

                {/* Slide Dots */}
                <div className="flex items-center gap-1.5">
                    {slides.map((slide, index) => (
                        <button
                            key={slide.id}
                            onClick={() => goToSlide(index)}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                index === currentSlide
                                    ? "bg-emerald-500 w-6"
                                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                            )}
                            aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                        />
                    ))}
                </div>

                {/* Next Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={nextSlide}
                    disabled={currentSlide === slides.length - 1}
                >
                    <ChevronRightIcon className="h-4 w-4" />
                </Button>
            </div>

            {/* Slide Counter */}
            <div className="fixed bottom-6 right-6 text-xs text-muted-foreground">
                {currentSlide + 1} / {slides.length}
            </div>

            {/* Keyboard Hint */}
            <div className="fixed bottom-6 left-6 text-xs text-muted-foreground hidden md:block">
                Use ← → or Space to navigate
            </div>
        </div>
    );
}
