"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<"entered" | "idle">("entered");

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const isAboveFold = rect.top < window.innerHeight + 80;
        if (!isAboveFold) {
            setState("idle");
        }
    }, []);

    useEffect(() => {
        if (state !== "idle") return;
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setState("entered");
                    observer.disconnect();
                }
            },
            { threshold: 0.08 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [state]);

    const isHidden = state === "idle";

    return (
        <div
            ref={ref}
            className={cn(className)}
            style={{
                opacity: isHidden ? 0 : 1,
                transform: isHidden ? "translateY(20px)" : "translateY(0)",
                transition: isHidden
                    ? "none"
                    : `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}
