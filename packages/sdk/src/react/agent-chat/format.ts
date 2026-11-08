import type { WidgetColor, WidgetFormat } from '../../widgets/spec';

/** Format a widget value: numbers, money, percentages and dates, in the viewer's locale. */
export function formatValue(value: unknown, format?: WidgetFormat, currency?: string): string {
    if (value === null || value === undefined || value === '') return '—';
    if (format === 'date' || format === 'datetime') {
        const d = new Date(typeof value === 'number' ? value : String(value));
        if (Number.isNaN(d.getTime())) return String(value);
        return format === 'date'
            ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
            : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (!format || Number.isNaN(n) || typeof value === 'boolean') return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'number' ? n.toLocaleString() : String(value);
    try {
        switch (format) {
            case 'number': return n.toLocaleString();
            case 'compact': return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
            case 'percent': return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(n);
            case 'currency': return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'USD').toUpperCase(), maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }).format(n);
        }
    } catch {
        // unknown currency code
    }
    return n.toLocaleString();
}

/** Short axis labels: 48K, $1.2M, 12%. */
export function formatAxis(n: number, format?: WidgetFormat, currency?: string): string {
    if (format === 'percent') return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(n);
    if (format === 'currency') {
        try {
            return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'USD').toUpperCase(), notation: 'compact', maximumFractionDigits: 1 }).format(n);
        } catch { /* fall through */ }
    }
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function colorVar(color: WidgetColor | undefined, fallback = 'var(--cen-fg)'): string {
    switch (color) {
        case 'muted': return 'var(--cen-muted-fg)';
        case 'accent': return 'var(--cen-accent)';
        case 'success': return 'var(--cen-success)';
        case 'warning': return 'var(--cen-warning)';
        case 'danger': return 'var(--cen-danger)';
        case 'info': return 'var(--cen-info)';
        case 'default': return 'var(--cen-fg)';
        default: return fallback;
    }
}

const SERIES = ['var(--cen-accent)', 'var(--cen-chart-2)', 'var(--cen-chart-3)', 'var(--cen-chart-4)', 'var(--cen-chart-5)', 'var(--cen-chart-6)'];
export function seriesColor(i: number, color?: WidgetColor): string {
    return color && color !== 'default' ? colorVar(color) : SERIES[i % SERIES.length];
}

/** Round axis bounds and 4-6 ticks. */
export function niceScale(min: number, max: number, count = 5): { min: number; max: number; ticks: number[] } {
    if (min === max) { max = min === 0 ? 1 : min * 1.1; if (min > 0) min = 0; }
    const span = max - min;
    const step0 = span / Math.max(1, count - 1);
    const mag = 10 ** Math.floor(Math.log10(step0));
    const norm = step0 / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
    return { min: lo, max: hi, ticks };
}
