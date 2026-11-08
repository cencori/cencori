'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartNode } from '../../widgets/spec';
import { formatAxis, formatValue, niceScale, seriesColor } from './format';

/** Bar, line, area and pie charts in plain SVG: no chart library to install. */
export function WidgetChart({ node }: { node: ChartNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(480);
    const [hover, setHover] = useState<number | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const height = Math.min(480, Math.max(120, node.height ?? (node.chart === 'pie' ? 200 : 220)));
    const legend = node.series.length > 1 || node.chart === 'pie';

    return (
        <div className="cen-w-chart" ref={ref} style={{ position: 'relative' }}>
            {node.title && <div className="cen-w-stat-label" style={{ marginBottom: 8 }}>{node.title}</div>}
            {node.chart === 'pie'
                ? <Pie node={node} width={width} height={height} hover={hover} setHover={setHover} />
                : <Cartesian node={node} width={width} height={height} hover={hover} setHover={setHover} />}
            {legend && (
                <div className="cen-w-legend">
                    {node.chart === 'pie'
                        ? node.data.map((d, i) => (
                            <span key={i}><i style={{ background: seriesColor(i) }} />{String(d[node.x] ?? '')}</span>
                        ))
                        : node.series.map((s, i) => (
                            <span key={s.key}><i style={{ background: seriesColor(i, s.color) }} />{s.label ?? s.key}</span>
                        ))}
                </div>
            )}
        </div>
    );
}

interface PlotProps {
    node: ChartNode;
    width: number;
    height: number;
    hover: number | null;
    setHover: (i: number | null) => void;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);

function Cartesian({ node, width, height, hover, setHover }: PlotProps) {
    const { data, series, x, stacked, format, currency } = node;
    const pad = { top: 8, right: 8, bottom: 24, left: 44 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;

    const scale = useMemo(() => {
        let lo = 0;
        let hi = 0;
        for (const d of data) {
            if (stacked) {
                let pos = 0, neg = 0;
                for (const s of series) { const v = num(d[s.key]) ?? 0; if (v >= 0) pos += v; else neg += v; }
                hi = Math.max(hi, pos); lo = Math.min(lo, neg);
            } else {
                for (const s of series) { const v = num(d[s.key]); if (v !== null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }
            }
        }
        return niceScale(lo, hi);
    }, [data, series, stacked]);

    const y = (v: number) => pad.top + h - ((v - scale.min) / (scale.max - scale.min || 1)) * h;
    const n = Math.max(1, data.length);
    const band = w / n;
    const cx = (i: number) => pad.left + band * i + band / 2;
    const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 64))));

    const bars = node.chart === 'bar';
    const groupW = Math.min(band * 0.72, 56 * (stacked ? 1 : series.length));
    const barW = stacked ? groupW : groupW / series.length;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={node.title ?? 'Chart'}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
                const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * width;
                const i = Math.floor((px - pad.left) / band);
                setHover(i >= 0 && i < data.length ? i : null);
            }}>
            {scale.ticks.map((t) => (
                <g key={t}>
                    <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--cen-border)" strokeDasharray={t === 0 ? undefined : '3 3'} />
                    <text x={pad.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">{formatAxis(t, format, currency)}</text>
                </g>
            ))}
            {data.map((d, i) => (i % labelEvery === 0 ? (
                <text key={i} x={cx(i)} y={height - 6} textAnchor="middle">{truncate(String(d[x] ?? ''), Math.max(4, Math.floor(band * labelEvery / 7)))}</text>
            ) : null))}
            {hover !== null && !bars && <line x1={cx(hover)} x2={cx(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--cen-border)" />}
            {bars && hover !== null && <rect x={pad.left + band * hover} y={pad.top} width={band} height={h} fill="var(--cen-muted)" opacity={0.6} />}

            {bars
                ? data.map((d, i) => {
                    let pos = 0, neg = 0;
                    return series.map((s, si) => {
                        const v = num(d[s.key]);
                        if (v === null) return null;
                        let top: number, bottom: number, bx: number;
                        if (stacked) {
                            const base = v >= 0 ? pos : neg;
                            if (v >= 0) pos += v; else neg += v;
                            top = y(Math.max(base, base + v)); bottom = y(Math.min(base, base + v));
                            bx = cx(i) - barW / 2;
                        } else {
                            top = y(Math.max(0, v)); bottom = y(Math.min(0, v));
                            bx = cx(i) - groupW / 2 + barW * si;
                        }
                        return <rect key={`${i}-${s.key}`} x={bx + (stacked ? 0 : 1)} y={top} width={Math.max(1, barW - (stacked ? 0 : 2))} height={Math.max(1, bottom - top)} rx={Math.min(3, barW / 4)} fill={seriesColor(si, s.color)} />;
                    });
                })
                : series.map((s, si) => {
                    const pts = data.map((d, i) => [cx(i), num(d[s.key])] as const).filter((p): p is readonly [number, number] => p[1] !== null);
                    if (pts.length === 0) return null;
                    const line = pts.map(([px, v], k) => `${k ? 'L' : 'M'}${px},${y(v)}`).join(' ');
                    const color = seriesColor(si, s.color);
                    return (
                        <g key={s.key}>
                            {node.chart === 'area' && (
                                <path d={`${line} L${pts[pts.length - 1][0]},${y(Math.max(scale.min, 0))} L${pts[0][0]},${y(Math.max(scale.min, 0))} Z`} fill={color} opacity={0.12} />
                            )}
                            <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                            {hover !== null && num(data[hover]?.[s.key]) !== null && (
                                <circle cx={cx(hover)} cy={y(num(data[hover][s.key])!)} r={3.5} fill="var(--cen-surface)" stroke={color} strokeWidth={2} />
                            )}
                        </g>
                    );
                })}

            {hover !== null && data[hover] && (
                <foreignObject x={0} y={0} width={width} height={height} style={{ pointerEvents: 'none', overflow: 'visible' }}>
                    <div className="cen-w-tooltip" style={{ left: cx(hover), top: pad.top + 8 }}>
                        <div style={{ fontWeight: 600 }}>{String(data[hover][x] ?? '')}</div>
                        {series.map((s) => (
                            <div key={s.key}>{s.label ?? s.key}: {formatValue(data[hover][s.key], format, currency)}</div>
                        ))}
                    </div>
                </foreignObject>
            )}
        </svg>
    );
}

function Pie({ node, width, height, hover, setHover }: PlotProps) {
    const key = node.series[0]?.key;
    const values = node.data.map((d) => Math.max(0, num(d[key]) ?? 0));
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(height, width) / 2 - 4;
    const cx = width / 2;
    const cy = height / 2;
    let angle = -Math.PI / 2;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={node.title ?? 'Chart'} onMouseLeave={() => setHover(null)}>
            {values.map((v, i) => {
                const start = angle;
                const sweep = (v / total) * Math.PI * 2;
                angle += sweep;
                if (v === 0) return null;
                const end = start + sweep;
                const ro = hover === i ? r + 3 : r;
                const ri = r * 0.58;
                const large = sweep > Math.PI ? 1 : 0;
                const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
                const d = sweep >= Math.PI * 2 - 1e-6
                    ? `M${p(ro, 0)} A${ro},${ro} 0 1 1 ${p(ro, Math.PI)} A${ro},${ro} 0 1 1 ${p(ro, 0)} M${p(ri, 0)} A${ri},${ri} 0 1 0 ${p(ri, Math.PI)} A${ri},${ri} 0 1 0 ${p(ri, 0)} Z`
                    : `M${p(ro, start)} A${ro},${ro} 0 ${large} 1 ${p(ro, end)} L${p(ri, end)} A${ri},${ri} 0 ${large} 0 ${p(ri, start)} Z`;
                return <path key={i} d={d} fill={seriesColor(i)} stroke="var(--cen-surface)" strokeWidth={1.5} fillRule="evenodd" onMouseEnter={() => setHover(i)} />;
            })}
            <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 15, fontWeight: 600, fill: 'var(--cen-fg)' }}>
                {hover !== null ? formatValue(values[hover], node.format, node.currency) : formatValue(total === 1 && values.every((v) => v === 0) ? 0 : total, node.format, node.currency)}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle">
                {hover !== null ? truncate(String(node.data[hover]?.[node.x] ?? ''), 18) : 'Total'}
            </text>
        </svg>
    );
}

function truncate(s: string, max: number): string {
    return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
}
