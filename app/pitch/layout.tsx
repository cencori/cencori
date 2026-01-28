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

export default function PitchLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const handleExport = async (format: "pdf" | "pptx" | "docx") => {
        try {
            const response = await fetch(`/api/pitch/export?format=${format}`);
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `cencori-pitch-deck.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
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
                                >
                                    <ArrowDownTrayIcon className="h-3 w-3" />
                                    Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                                    <span className="text-xs">Download PDF</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("pptx")}>
                                    <span className="text-xs">Download PPTX</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("docx")}>
                                    <span className="text-xs">Download DOCX</span>
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
        </div>
    );
}
