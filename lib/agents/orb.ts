/** FNV-1a: a small, stable hash so the same seed always draws the same orb. */
function hash(seed: string) {
    let value = 2166136261;
    for (let index = 0; index < seed.length; index++) {
        value ^= seed.charCodeAt(index);
        value = Math.imul(value, 16777619);
    }
    return value >>> 0;
}

/**
 * The CSS background for an agent's orb. Colors and swirl come from the seed
 * (an agent or template id). Shared by the console avatar and the website
 * widget, which draws it outside React.
 */
export function orbBackground(seed: string): string {
    const value = hash(seed);
    const hue = value % 360;
    const accent = (hue + 35 + ((value >>> 9) % 70)) % 360;
    const turn = (value >>> 3) % 360;
    const light = 52 + ((value >>> 17) % 12);
    return `conic-gradient(from ${turn}deg, hsl(${hue} 90% ${light}%), hsl(${accent} 92% ${light + 10}%), hsl(${hue} 85% ${light - 22}%), hsl(${accent} 95% ${light + 18}%), hsl(${hue} 90% ${light}%))`;
}

/** The glossy highlight laid over the orb. */
export const ORB_HIGHLIGHT = "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 22%, transparent 48%)";
