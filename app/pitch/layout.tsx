"use client";

import React from "react";
import Link from "next/link";
import { PITCH_SLIDES } from "@/lib/pitch-slides";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { useRef, useState } from "react";

export default function PitchLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const exportWidth = 1280;
    const exportHeight = 840;
    const exportContainerRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (format: "pdf" | "pptx" | "docx") => {
        if (format !== "pdf") {
            alert("Only PDF export is fully supported right now.");
            return;
        }

        if (!exportContainerRef.current) return;

        try {
            setIsExporting(true);
            const slides = Array.from(exportContainerRef.current.children) as HTMLElement[];
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "px",
                format: [exportWidth, exportHeight],
            });

            for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];

                // Capture slide
                const imgData = await toJpeg(slide, {
                    quality: 0.95,
                    width: exportWidth,
                    height: exportHeight,
                    pixelRatio: 2, // High DPI capture for text sharpness
                    backgroundColor: "#0a0a0a", // Force dark background if transparent
                    style: {
                        transform: 'scale(1)', // Ensure no unintended scaling
                    }
                });

                if (i > 0) pdf.addPage([exportWidth, exportHeight], "landscape");
                pdf.addImage(imgData, "JPEG", 0, 0, exportWidth, exportHeight);

                // Small delay to prevent UI freeze
                await new Promise(r => setTimeout(r, 100));
            }

            pdf.save("cencori-pitch-deck.pdf");
        } catch (error) {
            console.error("Export error:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#030303] text-white dark">
            {/* Fixed Header */}
            <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#030303]/96 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
                    <Link href="/pitch" className="flex items-baseline gap-2">
                        <span className="text-base font-semibold tracking-[-0.03em] text-white">Cencori</span>
                        <span className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                            Pitch Deck
                        </span>
                    </Link>

                    <div className="flex items-center gap-5">
                        <button
                            type="button"
                            className="text-[11px] uppercase tracking-[0.24em] text-zinc-400 transition-colors hover:text-white disabled:text-zinc-700"
                            onClick={() => handleExport("pdf")}
                            disabled={isExporting}
                        >
                            {isExporting ? "Exporting..." : "Export PDF"}
                        </button>

                        <Link href="https://cencori.com" target="_blank">
                            <span className="text-[11px] uppercase tracking-[0.24em] text-zinc-400 transition-colors hover:text-white">
                                Visit Site
                            </span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-14">{children}</main>

            {/* Off-screen Export Container */}
            <div
                ref={exportContainerRef}
                style={{
                    position: "fixed",
                    top: "-10000px",
                    left: "-10000px",
                    width: `${exportWidth}px`,
                    height: `${exportHeight}px`,
                    pointerEvents: "none",
                }}
            >
                {PITCH_SLIDES.map((slide) => (
                    <div
                        key={slide.id}
                        style={{ width: `${exportWidth}px`, height: `${exportHeight}px` }}
                        className="bg-[#050505] text-white"
                    >
                        <slide.component />
                    </div>
                ))}
            </div>
        </div>
    );
}
