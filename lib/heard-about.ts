/**
 * "How did you hear about us?" — asked once per person, at onboarding (or in
 * Studio setup for anyone who skipped it). The answer is kept on the user
 * (user_metadata.heard_about) and sent to PostHog as `heard_about_answered`;
 * the internal dashboard counts it. Client-safe.
 */

export const HEARD_ABOUT_OPTIONS = [
    { id: "instagram", label: "Instagram" },
    { id: "x", label: "X (Twitter)" },
    { id: "tiktok", label: "TikTok" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "youtube", label: "YouTube" },
    { id: "search", label: "Google search" },
    { id: "ai_assistant", label: "ChatGPT, Claude or another AI" },
    { id: "friend", label: "A friend or colleague" },
    { id: "event", label: "An event or community" },
    { id: "other", label: "Something else" },
] as const;

export type HeardAboutSource = (typeof HEARD_ABOUT_OPTIONS)[number]["id"];
export type HeardAboutSurface = "onboarding" | "studio_setup";

export interface HeardAbout {
    source: HeardAboutSource;
    /** What they typed for "Something else" (or which friend, event…). */
    detail: string | null;
    surface: HeardAboutSurface;
    at: string;
}

export function heardAboutLabel(source: string): string {
    return HEARD_ABOUT_OPTIONS.find((option) => option.id === source)?.label ?? source;
}

export function isHeardAboutSource(value: unknown): value is HeardAboutSource {
    return typeof value === "string" && HEARD_ABOUT_OPTIONS.some((option) => option.id === value);
}

/** The answer kept on a user, if they've given one. */
export function readHeardAbout(metadata: Record<string, unknown> | null | undefined): HeardAbout | null {
    const value = metadata?.heard_about as Partial<HeardAbout> | undefined;
    return value && isHeardAboutSource(value.source) ? (value as HeardAbout) : null;
}
