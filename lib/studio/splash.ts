import screens from "@/lib/studio/splash-screens.json";

/**
 * iOS launch screens for Studio on the Home Screen: one per screen size, light
 * and dark (scripts/generate-studio-splash.mjs makes the images). iOS picks the
 * one whose media query matches the device.
 */
export const STUDIO_STARTUP_IMAGES = screens.flatMap(({ width, height, dpr }) =>
    (["light", "dark"] as const).map((theme) => ({
        url: `/studio/splash/studio-${width * dpr}x${height * dpr}-${theme}.png`,
        media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`,
    })),
);
