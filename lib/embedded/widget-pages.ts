/**
 * Which pages of a site the website widget's launcher shows on. Kept free of
 * server imports so the console can use it too; public/widget.js carries a
 * copy of pageAllowed().
 */

export type WidgetPages = 'only' | 'except' | 'all';
export const WIDGET_MAX_PAGE_PATHS = 30;
/** New and unconfigured widgets: the landing page only. */
export const WIDGET_DEFAULT_PAGE_PATHS = ['/'];


/**
 * Normalize a page rule someone typed: "pricing" → "/pricing",
 * "https://x.com/blog/*" → "/blog/*", "/docs/" → "/docs". Null when it isn't one.
 */
export function normalizePagePath(input: string): string | null {
    let value = input.trim();
    if (!value) return null;
    if (value === '*' || value === '/*') return '/*';
    if (/^https?:\/\//i.test(value)) {
        try { value = new URL(value.replace(/\*/g, '__star__')).pathname.replace(/__star__/g, '*'); } catch { return null; }
    }
    value = value.split(/[?#]/)[0];
    if (!value.startsWith('/')) value = `/${value}`;
    value = value.replace(/\/{2,}/g, '/');
    if (value.length > 1) value = value.replace(/\/+$/, '');
    // A star only as the last segment: "/blog/*".
    if (value.includes('*') && !/^\/[^*]*\/\*$|^\/\*$/.test(value)) return null;
    if (value.length > 200 || /\s/.test(value)) return null;
    return value;
}

/** Same rule the loader applies (public/widget.js keeps a copy). */
export function pageAllowed(pathname: string, pages: WidgetPages, paths: readonly string[]): boolean {
    if (pages === 'all') return true;
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const hit = paths.some((rule) => {
        if (rule === '/*') return true;
        if (rule.endsWith('/*')) {
            const base = rule.slice(0, -2);
            return path === base || path.startsWith(`${base}/`);
        }
        return path === rule;
    });
    return pages === 'only' ? hit : !hit;
}
