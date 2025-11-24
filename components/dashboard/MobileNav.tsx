"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";

interface MobileNavProps {
    onMenuClick: () => void;
    projectSlug?: string | null;
}

export function MobileNav({ onMenuClick, projectSlug }: MobileNavProps) {
    const { setEnvironment, isTestMode } = useEnvironment();

    return (
        <div className="sticky top-12 z-40 lg:hidden border-b dark:border-zinc-800 bg-background px-4 h-14 flex items-center gap-3">
            <Button
                variant="ghost"
                size="icon"
                onClick={onMenuClick}
                className="h-8 w-8 mt-1.75"
                aria-label="Open navigation menu"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Environment Switcher - only show when in a project */}
            {projectSlug && (
                <div className="flex items-center justify-center bg-muted/50 rounded-full p-0.5 border border-border ml-auto mt-2">
                    <button
                        onClick={() => setEnvironment("production")}
                        className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all flex items-center justify-center ${!isTestMode
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm"
                            : "text-muted-foreground"
                            }`}
                    >
                        Prod
                    </button>
                    <button
                        onClick={() => setEnvironment("test")}
                        className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all flex items-center justify-center ${isTestMode
                            ? "bg-orange-500/10 text-orange-600 border border-orange-500/20 shadow-sm"
                            : "text-muted-foreground"
                            }`}
                    >
                        Dev
                    </button>
                </div>
            )}
        </div>
    );
}
