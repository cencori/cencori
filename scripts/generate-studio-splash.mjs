// Studio's iOS launch screens (apple-touch-startup-image): the Studio mark,
// centred, on the app's background, light and dark, one per iPhone / iPad
// screen size. iOS shows nothing of its own while a Home Screen app starts, so
// without these it's a blank white screen. Run: node scripts/generate-studio-splash.mjs
// Writes public/studio/splash/*.png for the screens in lib/studio/splash-screens.json
// (app/studio-app/layout.tsx links them through lib/studio/splash.ts).
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";

// The mark from public/studio/icon-512.png, as shapes (its 256×256 square).
const mark = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="128 128 256 256">
  <clipPath id="c"><rect x="128" y="128" width="256" height="256" rx="7"/></clipPath>
  <g clip-path="url(#c)" fill="${fill}">
    <path d="M128 128 H308 A90 90 0 0 1 128 128 Z"/>
    <path d="M128 203 V383 A90 90 0 0 0 128 203 Z"/>
    <path d="M383 128 V308 A90 90 0 0 1 383 128 Z"/>
    <path d="M203 383 H383 A90 90 0 0 0 203 383 Z"/>
  </g>
</svg>`;

// Portrait screens in CSS points and device pixel ratio (shared with the layout).
const SCREENS = JSON.parse(readFileSync(new URL("../lib/studio/splash-screens.json", import.meta.url), "utf8")).map((s) => [s.width, s.height, s.dpr]);

const THEMES = { light: { background: "#ffffff", mark: "#111111" }, dark: { background: "#000000", mark: "#ffffff" } };

const out = "public/studio/splash";
mkdirSync(out, { recursive: true });
for (const [w, h, dpr] of SCREENS) {
    for (const [name, theme] of Object.entries(THEMES)) {
        const width = w * dpr;
        const height = h * dpr;
        const size = Math.round(88 * dpr); // the mark, 88 pt across
        const file = `${out}/studio-${width}x${height}-${name}.png`;
        const art = await sharp(Buffer.from(mark(theme.mark)), { density: 72 * (size / 256) * 4 }).resize(size, size).png().toBuffer();
        await sharp({ create: { width, height, channels: 3, background: theme.background } })
            .composite([{ input: art, left: Math.round((width - size) / 2), top: Math.round((height - size) / 2) }])
            .png({ compressionLevel: 9, palette: true })
            .toFile(file);
    }
}
console.log(`${SCREENS.length * 2} launch screens in ${out}`);
