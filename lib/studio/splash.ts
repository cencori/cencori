import screens from "@/lib/studio/splash-screens.json";

/**
 * iOS launch screens for Studio on the Home Screen: one per screen size, light
 * and dark (scripts/generate-studio-splash.mjs makes the images). iOS picks the
 * one whose media query matches the device.
 */
export const STUDIO_STARTUP_IMAGES = [
    // Dark first, matched only in dark mode; then light for everything else, so
    // a device that ignores prefers-color-scheme here still gets a launch screen.
    ...screens.map(({ width, height, dpr }) => image(width, height, dpr, "dark")),
    ...screens.map(({ width, height, dpr }) => image(width, height, dpr, "light")),
];

function image(width: number, height: number, dpr: number, theme: "light" | "dark") {
    const device = `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`;
    return {
        url: `/studio/splash/studio-${width * dpr}x${height * dpr}-${theme}.png`,
        media: theme === "dark" ? `${device} and (prefers-color-scheme: dark)` : device,
    };
}
