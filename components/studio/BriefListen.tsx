"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useStudio } from "@/components/studio/StudioShell";

/**
 * Listen to this morning's brief. The audio is only made when tapped (it
 * costs a little each time it's made), then the phone keeps it for the day.
 */
export function BriefListen({ at }: { at: string }) {
    const { project } = useStudio();
    const audio = useRef<HTMLAudioElement | null>(null);
    const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");

    useEffect(() => () => audio.current?.pause(), []);

    const toggle = () => {
        if (state === "playing") {
            audio.current?.pause();
            return;
        }
        if (!audio.current) {
            const element = new Audio(`/api/studio/brief/voice?project_id=${project.id}&at=${encodeURIComponent(at)}`);
            element.onplaying = () => setState("playing");
            element.onpause = () => setState((current) => (current === "error" ? current : "paused"));
            element.onended = () => setState("idle");
            element.onerror = () => {
                audio.current = null;
                setState("error");
            };
            audio.current = element;
        }
        setState("loading");
        audio.current.play().catch(() => setState("error"));
    };

    return (
        <button type="button" onClick={toggle} disabled={state === "loading"} className="mt-3 flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-semibold disabled:opacity-70">
            {state === "loading" ? <Spinner className="h-4 w-4 animate-spin" /> : state === "playing" ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            {state === "playing" ? "Pause" : state === "paused" ? "Resume" : state === "error" ? "Try again" : "Listen"}
        </button>
    );
}
