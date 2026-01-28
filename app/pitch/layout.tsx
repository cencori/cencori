"use client";

import React from "react";
import Link from "next/link";
import {
    ArrowDownTrayIcon,
    ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import script from "next/script";
import { PITCH_SLIDES } from "@/lib/pitch-slides";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function PitchLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
                format: [1920, 1080], // Match slide aspect ratio
            });

            for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];

                // Capture slide
                const imgData = await toJpeg(slide, {
                    quality: 0.95,
                    width: 1920,
                    height: 1080,
                    backgroundColor: "#0a0a0a", // Force dark background if transparent
                    style: {
                        transform: 'scale(1)', // Ensure no unintended scaling
                    }
                });

                if (i > 0) pdf.addPage([1920, 1080], "landscape");
                pdf.addImage(imgData, "JPEG", 0, 0, 1920, 1080);

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
        <div className="min-h-screen bg-background text-foreground dark">
            {/* Fixed Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <Link href="/pitch" className="flex items-center gap-2">
                        <span className="font-bold text-lg">Cencori</span>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
                            Pitch Deck
                        </span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-xs rounded-full gap-1.5"
                                    disabled={isExporting}
                                >
                                    {isExporting ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <ArrowDownTrayIcon className="h-3 w-3" />
                                    )}
                                    {isExporting ? "Exporting..." : "Export"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                                    <span className="text-xs">Download PDF</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("pptx")}>
                                    <span className="text-xs text-muted-foreground">
                                        Download PPTX (Soon)
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("docx")}>
                                    <span className="text-xs text-muted-foreground">
                                        Download DOCX (Soon)
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Link href="https://cencori.com" target="_blank">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-xs rounded-full gap-1.5"
                            >
                                Visit Site
                                <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                            </Button>
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
                    width: "1920px",
                    height: "1080px", // Fixed 16:9 1080p size for capture
                    pointerEvents: "none",
                }}
            >
                {PITCH_SLIDES.map((slide) => (
                    <div
                        key={slide.id}
                        style={{ width: "1920px", height: "1080px" }}
                        className="bg-card text-foreground"
                    >
                        <slide.component />
                    </div>
                ))}
            </div>
        </div>
    );
}
