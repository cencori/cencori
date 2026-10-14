"use client";

import { useEffect, useRef } from "react";

export type DitherVariant = "clouds";

interface DitherCanvasProps {
    // Image to dither (same-origin). Without one, the generated `variant` is
    // rendered so the slot has artwork before the real image is ready.
    src?: string;
    variant?: DitherVariant;
    // Size of one dither cell in CSS pixels; each cell is drawn as a dot with
    // a 1px gap, which gives the visible grid.
    cellSize?: number;
    // Tones between black and white (2 = pure 1-bit, 3 adds a mid grey).
    levels?: number;
    // Custom palette, darkest first (index 0 is the background). Overrides
    // `levels`, e.g. ["#000000", "#2b1150", "#5a2d91"] for a purple dither.
    colors?: string[];
    className?: string;
}

const TONES: Record<number, string[]> = {
    2: ["#000000", "#f2f2f2"],
    3: ["#000000", "#6e6e6e", "#f2f2f2"],
    4: ["#000000", "#4a4a4a", "#9a9a9a", "#f2f2f2"],
};

// 8x8 ordered-dither threshold map, normalised to (0, 1).
const BAYER_8 = (() => {
    const base = [[0, 2], [3, 1]];
    let m = base;
    while (m.length < 8) {
        const n = m.length;
        const next: number[][] = Array.from({ length: n * 2 }, () => new Array(n * 2).fill(0));
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const v = m[y][x] * 4;
                next[y][x] = v;
                next[y][x + n] = v + 2;
                next[y + n][x] = v + 3;
                next[y + n][x + n] = v + 1;
            }
        }
        m = next;
    }
    return m.map((row) => row.map((v) => (v + 0.5) / 64));
})();

function hash(x: number, y: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 5; i++) {
        sum += amp * valueNoise(x * freq, y * freq);
        freq *= 2;
        amp *= 0.5;
    }
    return sum;
}

// Domain-warped fbm: soft cloud shapes, mostly dark with bright edges.
function cloudField(cols: number, rows: number, t: number): Float32Array {
    const out = new Float32Array(cols * rows);
    const scale = 2.4 / Math.max(cols, rows);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const px = x * scale;
            const py = y * scale;
            const wx = fbm(px + t * 0.05, py);
            const wy = fbm(px + 5.2, py + 1.3 - t * 0.04);
            const v = fbm(px + 2.2 * wx, py + 2.2 * wy);
            out[y * cols + x] = Math.min(1, Math.max(0, (v - 0.36) * 2.6)) ** 1.5;
        }
    }
    return out;
}

const FIELDS: Record<DitherVariant, (cols: number, rows: number, t: number) => Float32Array> = {
    clouds: cloudField,
};

function imageField(img: HTMLImageElement, cols: number, rows: number): Float32Array {
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const out = new Float32Array(cols * rows);
    if (!ctx) return out;

    // object-fit: cover
    const scale = Math.max(cols / img.naturalWidth, rows / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (cols - w) / 2, (rows - h) / 2, w, h);

    const { data } = ctx.getImageData(0, 0, cols, rows);
    for (let i = 0; i < out.length; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        out[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    // Auto-levels: stretch the image's own tonal range to full black → white
    // so dark renders (a grey subject on black) still dither with real
    // highlights instead of a murky silhouette.
    const sorted = Float32Array.from(out).sort();
    const lo = sorted[Math.floor(sorted.length * 0.02)];
    const hi = sorted[Math.floor(sorted.length * 0.998)];
    const range = Math.max(hi - lo, 1e-3);
    for (let i = 0; i < out.length; i++) {
        out[i] = Math.min(1, Math.max(0, (out[i] - lo) / range)) ** 0.85;
    }
    return out;
}

function paint(
    ctx: CanvasRenderingContext2D,
    field: Float32Array,
    cols: number,
    rows: number,
    cell: number,
    tones: string[],
) {
    const levels = tones.length;
    const buckets: number[][] = tones.map(() => []);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const scaled = field[y * cols + x] * (levels - 1);
            const base = Math.floor(scaled);
            const level = Math.min(levels - 1, base + (scaled - base > BAYER_8[y & 7][x & 7] ? 1 : 0));
            if (level > 0) buckets[level].push(x, y);
        }
    }

    ctx.fillStyle = tones[0];
    ctx.fillRect(0, 0, cols * cell, rows * cell);
    const dot = Math.max(1, cell - 1);
    for (let level = 1; level < levels; level++) {
        ctx.fillStyle = tones[level];
        const cells = buckets[level];
        for (let i = 0; i < cells.length; i += 2) {
            ctx.fillRect(cells[i] * cell, cells[i + 1] * cell, dot, dot);
        }
    }
}

export function DitherCanvas({ src, variant = "clouds", cellSize = 3, levels = 3, colors, className }: DitherCanvasProps) {
    // Joined so an inline array literal doesn't restart the effect each render.
    const palette = colors?.join(",");
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const tones = palette ? palette.split(",") : TONES[levels] ?? TONES[3];
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let image: HTMLImageElement | null = null;
        let cols = 0;
        let rows = 0;
        let frame = 0;
        let last = 0;
        let start = performance.now();
        let disposed = false;

        const draw = (now: number) => {
            if (!cols || !rows) return;
            const field = image
                ? imageField(image, cols, rows)
                : FIELDS[variant](cols, rows, (now - start) / 1000);
            paint(ctx, field, cols, rows, cellSize, tones);
        };

        const resize = () => {
            const { width, height } = canvas.getBoundingClientRect();
            cols = Math.max(1, Math.floor(width / cellSize));
            rows = Math.max(1, Math.floor(height / cellSize));
            // Drawn at CSS-pixel resolution and scaled with nearest-neighbour
            // so the dots stay crisp.
            canvas.width = cols * cellSize;
            canvas.height = rows * cellSize;
            draw(performance.now());
        };

        // Generated fields animate at ~12fps; an image is static.
        const tick = (now: number) => {
            if (disposed) return;
            if (now - last > 83) {
                last = now;
                draw(now);
            }
            frame = requestAnimationFrame(tick);
        };

        const observer = new ResizeObserver(resize);
        observer.observe(canvas);

        if (src) {
            const img = new window.Image();
            img.decoding = "async";
            img.onload = () => {
                if (disposed) return;
                image = img;
                draw(performance.now());
            };
            img.src = src;
        } else if (!reduceMotion) {
            start = performance.now();
            frame = requestAnimationFrame(tick);
        }

        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [src, variant, cellSize, levels, palette]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={className}
            style={{ imageRendering: "pixelated" }}
        />
    );
}
