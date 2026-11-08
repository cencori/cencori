/**
 * Agent UI widgets: UI an agent shows in a chat instead of (or beside) text.
 *
 * A widget is a JSON tree of components. The model can write one itself with
 * the built-in `render_ui` tool, or a developer's tool can return
 * `{ widget }`. Either way it's checked against this spec before anything
 * renders, so a malformed widget is rejected (with errors the model can fix)
 * rather than breaking the page.
 *
 * This file has no dependencies: the gateway, the agents SDK and the React
 * renderer all import it, so there is one definition of what a widget is.
 */

// ── Types ───────────────────────────────────────────────────────

export type WidgetColor = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type WidgetFormat = 'number' | 'compact' | 'currency' | 'percent' | 'date' | 'datetime';
export type WidgetGap = 'none' | 'xs' | 'sm' | 'md' | 'lg';

/**
 * What a button, list item, form or select does when used. By default
 * (`handler: 'agent'`) it goes back to the agent as the user's next message;
 * `handler: 'client'` only calls the page's `onAction`.
 */
export interface WidgetAction {
    type: string;
    payload?: Record<string, unknown>;
    handler?: 'agent' | 'client';
}

export interface CardNode { type: 'Card'; title?: string; subtitle?: string; status?: string; children: WidgetNode[]; actions?: ButtonNode[] }
export interface ListViewItem { title: string; subtitle?: string; value?: string; badge?: string; badgeColor?: WidgetColor; image?: string; action?: WidgetAction }
export interface ListViewNode { type: 'ListView'; title?: string; items: ListViewItem[] }
export interface RowNode { type: 'Row'; children: WidgetNode[]; gap?: WidgetGap; align?: 'start' | 'center' | 'end' | 'stretch'; justify?: 'start' | 'center' | 'end' | 'between'; wrap?: boolean }
export interface ColNode { type: 'Col'; children: WidgetNode[]; gap?: WidgetGap; align?: 'start' | 'center' | 'end' | 'stretch'; flex?: number }
export interface DividerNode { type: 'Divider' }
export interface SpacerNode { type: 'Spacer' }
export interface TextNode { type: 'Text'; value: string; size?: 'xs' | 'sm' | 'md' | 'lg'; weight?: 'normal' | 'medium' | 'semibold' | 'bold'; color?: WidgetColor; align?: 'start' | 'center' | 'end'; truncate?: boolean }
export interface TitleNode { type: 'Title'; value: string; size?: 'sm' | 'md' | 'lg' | 'xl' }
export interface MarkdownNode { type: 'Markdown'; value: string }
export interface BadgeNode { type: 'Badge'; label: string; color?: WidgetColor }
export interface ImageNode { type: 'Image'; src: string; alt?: string; aspectRatio?: number; fit?: 'cover' | 'contain' }
export interface StatNode { type: 'Stat'; label: string; value: string | number; format?: WidgetFormat; currency?: string; delta?: number; deltaFormat?: 'percent' | 'number'; caption?: string }
export interface ChartSeries { key: string; label?: string; color?: WidgetColor }
export interface ChartNode {
    type: 'Chart';
    chart: 'bar' | 'line' | 'area' | 'pie';
    data: Array<Record<string, string | number | null>>;
    /** The data key for the x axis (pie: the slice label). */
    x: string;
    series: ChartSeries[];
    stacked?: boolean;
    height?: number;
    format?: WidgetFormat;
    currency?: string;
    title?: string;
}
export interface TableColumn { key: string; label: string; align?: 'start' | 'end' | 'center'; format?: WidgetFormat; currency?: string }
export interface TableNode { type: 'Table'; columns: TableColumn[]; rows: Array<Record<string, string | number | boolean | null>>; title?: string }
export interface ButtonNode { type: 'Button'; label: string; action?: WidgetAction; href?: string; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'; size?: 'sm' | 'md'; block?: boolean; submit?: boolean }
export interface FormNode { type: 'Form'; children: WidgetNode[]; action: WidgetAction; submitLabel?: string }
export interface InputNode { type: 'Input'; name: string; label?: string; placeholder?: string; inputType?: 'text' | 'number' | 'email' | 'date' | 'tel' | 'url'; required?: boolean; defaultValue?: string | number; multiline?: boolean }
export interface SelectOption { label: string; value: string }
export interface SelectNode { type: 'Select'; name: string; label?: string; options: SelectOption[]; placeholder?: string; defaultValue?: string; required?: boolean; action?: WidgetAction }
export interface CheckboxNode { type: 'Checkbox'; name: string; label: string; defaultChecked?: boolean }

export type WidgetNode =
    | CardNode | ListViewNode | RowNode | ColNode | DividerNode | SpacerNode
    | TextNode | TitleNode | MarkdownNode | BadgeNode | ImageNode
    | StatNode | ChartNode | TableNode
    | ButtonNode | FormNode | InputNode | SelectNode | CheckboxNode;

export type WidgetType = WidgetNode['type'];

/** A widget as delivered to a chat: the tree plus the id it's known by. */
export interface RenderedWidget {
    id: string;
    widget: WidgetNode;
}

// ── Limits ──────────────────────────────────────────────────────

export const WIDGET_LIMITS = {
    maxBytes: 64 * 1024,
    maxNodes: 400,
    maxDepth: 12,
    maxString: 4000,
    maxListItems: 100,
    maxTableRows: 200,
    maxTableColumns: 20,
    maxChartPoints: 500,
    maxChartSeries: 12,
    maxOptions: 100,
    maxPayloadBytes: 4 * 1024,
} as const;

// ── Prop table ──────────────────────────────────────────────────
// One table drives validation and the description the model reads.

type PropKind =
    | { k: 'string' } | { k: 'number' } | { k: 'boolean' } | { k: 'scalar' }
    | { k: 'enum'; values: readonly string[] }
    | { k: 'children' } | { k: 'buttons' } | { k: 'action' } | { k: 'url'; images?: boolean }
    | { k: 'items' } | { k: 'options' } | { k: 'series' } | { k: 'columns' } | { k: 'rows' } | { k: 'data' };

interface PropSpec { kind: PropKind; required?: boolean }

const S: PropKind = { k: 'string' };
const N: PropKind = { k: 'number' };
const B: PropKind = { k: 'boolean' };
const e = (...values: string[]): PropKind => ({ k: 'enum', values });
const req = (kind: PropKind): PropSpec => ({ kind, required: true });
const opt = (kind: PropKind): PropSpec => ({ kind });

const COLORS = ['default', 'muted', 'accent', 'success', 'warning', 'danger', 'info'];
const FORMATS = ['number', 'compact', 'currency', 'percent', 'date', 'datetime'];
const GAPS = ['none', 'xs', 'sm', 'md', 'lg'];

const PROPS: Record<WidgetType, Record<string, PropSpec>> = {
    Card: { title: opt(S), subtitle: opt(S), status: opt(S), children: req({ k: 'children' }), actions: opt({ k: 'buttons' }) },
    ListView: { title: opt(S), items: req({ k: 'items' }) },
    Row: { children: req({ k: 'children' }), gap: opt(e(...GAPS)), align: opt(e('start', 'center', 'end', 'stretch')), justify: opt(e('start', 'center', 'end', 'between')), wrap: opt(B) },
    Col: { children: req({ k: 'children' }), gap: opt(e(...GAPS)), align: opt(e('start', 'center', 'end', 'stretch')), flex: opt(N) },
    Divider: {},
    Spacer: {},
    Text: { value: req(S), size: opt(e('xs', 'sm', 'md', 'lg')), weight: opt(e('normal', 'medium', 'semibold', 'bold')), color: opt(e(...COLORS)), align: opt(e('start', 'center', 'end')), truncate: opt(B) },
    Title: { value: req(S), size: opt(e('sm', 'md', 'lg', 'xl')) },
    Markdown: { value: req(S) },
    Badge: { label: req(S), color: opt(e(...COLORS)) },
    Image: { src: req({ k: 'url', images: true }), alt: opt(S), aspectRatio: opt(N), fit: opt(e('cover', 'contain')) },
    Stat: { label: req(S), value: req({ k: 'scalar' }), format: opt(e(...FORMATS)), currency: opt(S), delta: opt(N), deltaFormat: opt(e('percent', 'number')), caption: opt(S) },
    Chart: { chart: req(e('bar', 'line', 'area', 'pie')), data: req({ k: 'data' }), x: req(S), series: req({ k: 'series' }), stacked: opt(B), height: opt(N), format: opt(e(...FORMATS)), currency: opt(S), title: opt(S) },
    Table: { columns: req({ k: 'columns' }), rows: req({ k: 'rows' }), title: opt(S) },
    Button: { label: req(S), action: opt({ k: 'action' }), href: opt({ k: 'url' }), variant: opt(e('primary', 'secondary', 'outline', 'ghost', 'danger')), size: opt(e('sm', 'md')), block: opt(B), submit: opt(B) },
    Form: { children: req({ k: 'children' }), action: req({ k: 'action' }), submitLabel: opt(S) },
    Input: { name: req(S), label: opt(S), placeholder: opt(S), inputType: opt(e('text', 'number', 'email', 'date', 'tel', 'url')), required: opt(B), defaultValue: opt({ k: 'scalar' }), multiline: opt(B) },
    Select: { name: req(S), label: opt(S), options: req({ k: 'options' }), placeholder: opt(S), defaultValue: opt(S), required: opt(B), action: opt({ k: 'action' }) },
    Checkbox: { name: req(S), label: req(S), defaultChecked: opt(B) },
};

export const WIDGET_TYPES = Object.keys(PROPS) as WidgetType[];

// ── Validation ──────────────────────────────────────────────────

export type WidgetValidation =
    | { ok: true; widget: WidgetNode }
    | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v) ?? '').byteLength;

function safeUrl(v: string, images: boolean): boolean {
    if (images && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(v)) return v.length <= 200_000;
    try {
        const u = new URL(v);
        return u.protocol === 'https:' || (!images && u.protocol === 'mailto:');
    } catch {
        return false;
    }
}

/**
 * Check a widget against the spec. Returns a clean copy (unknown props
 * dropped) or every problem found, each with its path, worded so a model can
 * read them and send a corrected widget.
 */
export function validateWidget(input: unknown): WidgetValidation {
    const errors: string[] = [];
    let nodes = 0;

    if (bytes(input) > WIDGET_LIMITS.maxBytes) {
        return { ok: false, errors: [`widget is larger than ${WIDGET_LIMITS.maxBytes / 1024} KB; show fewer rows or points`] };
    }

    const str = (v: unknown, path: string): string | undefined => {
        if (typeof v !== 'string') { errors.push(`${path}: expected a string`); return undefined; }
        if (v.length > WIDGET_LIMITS.maxString) { errors.push(`${path}: longer than ${WIDGET_LIMITS.maxString} characters`); return undefined; }
        return v;
    };

    const action = (v: unknown, path: string): WidgetAction | undefined => {
        if (!isObj(v) || typeof v.type !== 'string' || !v.type.trim()) { errors.push(`${path}: expected { type: string, payload?: object, handler?: "agent" | "client" }`); return undefined; }
        const out: WidgetAction = { type: v.type.slice(0, 100) };
        if (v.payload !== undefined) {
            if (!isObj(v.payload)) errors.push(`${path}.payload: expected an object`);
            else if (bytes(v.payload) > WIDGET_LIMITS.maxPayloadBytes) errors.push(`${path}.payload: larger than 4 KB`);
            else out.payload = v.payload;
        }
        if (v.handler !== undefined) {
            if (v.handler !== 'agent' && v.handler !== 'client') errors.push(`${path}.handler: expected "agent" or "client"`);
            else out.handler = v.handler;
        }
        return out;
    };

    const prop = (kind: PropKind, v: unknown, path: string, depth: number): unknown => {
        switch (kind.k) {
            case 'string': return str(v, path);
            case 'number':
                if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${path}: expected a number`); return undefined; }
                return v;
            case 'boolean':
                if (typeof v !== 'boolean') { errors.push(`${path}: expected true or false`); return undefined; }
                return v;
            case 'scalar':
                if (typeof v === 'number' && Number.isFinite(v)) return v;
                return str(v, path);
            case 'enum':
                if (typeof v !== 'string' || !kind.values.includes(v)) { errors.push(`${path}: expected one of ${kind.values.map((x) => `"${x}"`).join(', ')}`); return undefined; }
                return v;
            case 'url': {
                const s = str(v, path);
                if (s === undefined) return undefined;
                if (!safeUrl(s, Boolean(kind.images))) { errors.push(`${path}: expected an https:// URL${kind.images ? ' or a base64 data:image URL' : ''}`); return undefined; }
                return s;
            }
            case 'action': return action(v, path);
            case 'children': {
                if (!Array.isArray(v)) { errors.push(`${path}: expected an array of components`); return undefined; }
                return v.map((c, i) => node(c, `${path}[${i}]`, depth + 1)).filter(Boolean);
            }
            case 'buttons': {
                if (!Array.isArray(v)) { errors.push(`${path}: expected an array of Button components`); return undefined; }
                return v.map((c, i) => {
                    if (!isObj(c) || c.type !== 'Button') { errors.push(`${path}[${i}]: expected a Button`); return undefined; }
                    return node(c, `${path}[${i}]`, depth + 1);
                }).filter(Boolean);
            }
            case 'items': {
                if (!Array.isArray(v)) { errors.push(`${path}: expected an array of items`); return undefined; }
                if (v.length > WIDGET_LIMITS.maxListItems) errors.push(`${path}: more than ${WIDGET_LIMITS.maxListItems} items`);
                return v.slice(0, WIDGET_LIMITS.maxListItems).map((it, i) => {
                    const p = `${path}[${i}]`;
                    if (!isObj(it)) { errors.push(`${p}: expected { title, subtitle?, value?, badge?, image?, action? }`); return undefined; }
                    const out: ListViewItem = { title: str(it.title, `${p}.title`) ?? '' };
                    if (it.subtitle !== undefined) out.subtitle = str(it.subtitle, `${p}.subtitle`);
                    if (it.value !== undefined) out.value = typeof it.value === 'number' ? String(it.value) : str(it.value, `${p}.value`);
                    if (it.badge !== undefined) out.badge = str(it.badge, `${p}.badge`);
                    if (it.badgeColor !== undefined) out.badgeColor = prop(e(...COLORS), it.badgeColor, `${p}.badgeColor`, depth) as WidgetColor;
                    if (it.image !== undefined) out.image = prop({ k: 'url', images: true }, it.image, `${p}.image`, depth) as string;
                    if (it.action !== undefined) out.action = action(it.action, `${p}.action`);
                    return out;
                }).filter(Boolean);
            }
            case 'options': {
                if (!Array.isArray(v) || v.length === 0) { errors.push(`${path}: expected a non-empty array of { label, value }`); return undefined; }
                if (v.length > WIDGET_LIMITS.maxOptions) errors.push(`${path}: more than ${WIDGET_LIMITS.maxOptions} options`);
                return v.slice(0, WIDGET_LIMITS.maxOptions).map((o, i) => {
                    if (!isObj(o)) { errors.push(`${path}[${i}]: expected { label, value }`); return undefined; }
                    return { label: str(o.label, `${path}[${i}].label`) ?? '', value: typeof o.value === 'number' ? String(o.value) : (str(o.value, `${path}[${i}].value`) ?? '') };
                }).filter(Boolean);
            }
            case 'series': {
                if (!Array.isArray(v) || v.length === 0) { errors.push(`${path}: expected a non-empty array of { key, label?, color? }`); return undefined; }
                if (v.length > WIDGET_LIMITS.maxChartSeries) errors.push(`${path}: more than ${WIDGET_LIMITS.maxChartSeries} series`);
                return v.slice(0, WIDGET_LIMITS.maxChartSeries).map((s, i) => {
                    if (!isObj(s)) { errors.push(`${path}[${i}]: expected { key, label?, color? }`); return undefined; }
                    const out: ChartSeries = { key: str(s.key, `${path}[${i}].key`) ?? '' };
                    if (s.label !== undefined) out.label = str(s.label, `${path}[${i}].label`);
                    if (s.color !== undefined) out.color = prop(e(...COLORS), s.color, `${path}[${i}].color`, depth) as WidgetColor;
                    return out;
                }).filter(Boolean);
            }
            case 'columns': {
                if (!Array.isArray(v) || v.length === 0) { errors.push(`${path}: expected a non-empty array of { key, label, align?, format? }`); return undefined; }
                if (v.length > WIDGET_LIMITS.maxTableColumns) errors.push(`${path}: more than ${WIDGET_LIMITS.maxTableColumns} columns`);
                return v.slice(0, WIDGET_LIMITS.maxTableColumns).map((c, i) => {
                    const p = `${path}[${i}]`;
                    if (!isObj(c)) { errors.push(`${p}: expected { key, label, align?, format? }`); return undefined; }
                    const out: TableColumn = { key: str(c.key, `${p}.key`) ?? '', label: str(c.label, `${p}.label`) ?? '' };
                    if (c.align !== undefined) out.align = prop(e('start', 'end', 'center'), c.align, `${p}.align`, depth) as TableColumn['align'];
                    if (c.format !== undefined) out.format = prop(e(...FORMATS), c.format, `${p}.format`, depth) as WidgetFormat;
                    if (c.currency !== undefined) out.currency = str(c.currency, `${p}.currency`);
                    return out;
                }).filter(Boolean);
            }
            case 'rows':
            case 'data': {
                const max = kind.k === 'rows' ? WIDGET_LIMITS.maxTableRows : WIDGET_LIMITS.maxChartPoints;
                if (!Array.isArray(v)) { errors.push(`${path}: expected an array of objects`); return undefined; }
                if (v.length > max) errors.push(`${path}: more than ${max} entries; aggregate or show fewer`);
                return v.slice(0, max).map((r, i) => {
                    if (!isObj(r)) { errors.push(`${path}[${i}]: expected an object`); return undefined; }
                    const out: Record<string, string | number | boolean | null> = {};
                    for (const [key, val] of Object.entries(r)) {
                        if (val === null || typeof val === 'number' || typeof val === 'boolean') out[key] = val;
                        else if (typeof val === 'string') out[key] = val.slice(0, 500);
                        else errors.push(`${path}[${i}].${key}: expected a string, number, boolean or null`);
                    }
                    return out;
                }).filter(Boolean);
            }
        }
    };

    function node(v: unknown, path: string, depth: number): WidgetNode | undefined {
        if (++nodes > WIDGET_LIMITS.maxNodes) {
            if (nodes === WIDGET_LIMITS.maxNodes + 1) errors.push(`widget has more than ${WIDGET_LIMITS.maxNodes} components`);
            return undefined;
        }
        if (depth > WIDGET_LIMITS.maxDepth) { errors.push(`${path}: nested deeper than ${WIDGET_LIMITS.maxDepth} levels`); return undefined; }
        if (!isObj(v)) { errors.push(`${path}: expected a component object with a "type"`); return undefined; }
        const type = v.type as WidgetType;
        const spec = PROPS[type];
        if (typeof type !== 'string' || !spec) {
            errors.push(`${path}: unknown component type ${JSON.stringify(v.type)}; use one of ${WIDGET_TYPES.join(', ')}`);
            return undefined;
        }
        const out: Record<string, unknown> = { type };
        for (const [name, ps] of Object.entries(spec)) {
            const value = v[name];
            if (value === undefined || value === null) {
                if (ps.required) errors.push(`${path} (${type}): missing "${name}"`);
                continue;
            }
            const clean = prop(ps.kind, value, `${path}.${name}`, depth);
            if (clean !== undefined) out[name] = clean;
        }
        if (type === 'Button' && out.action === undefined && out.href === undefined && !out.submit) {
            errors.push(`${path} (Button): needs an "action", an "href", or submit: true inside a Form`);
        }
        if (type === 'Chart' && Array.isArray(out.data) && Array.isArray(out.series)) {
            const keys = new Set((out.data as Array<Record<string, unknown>>).flatMap((d) => Object.keys(d)));
            if (keys.size > 0) {
                if (!keys.has(out.x as string)) errors.push(`${path} (Chart): x "${out.x as string}" is not a key in data`);
                for (const s of out.series as ChartSeries[]) {
                    if (!keys.has(s.key)) errors.push(`${path} (Chart): series key "${s.key}" is not a key in data`);
                }
            }
        }
        return out as unknown as WidgetNode;
    }

    const widget = node(input, 'widget', 0);
    if (errors.length > 0 || !widget) return { ok: false, errors: errors.length ? errors.slice(0, 30) : ['widget is empty'] };
    return { ok: true, widget };
}

/** True for a value that looks like `{ widget: {...} }`: what a developer's tool returns to show UI. */
export function isWidgetResult(v: unknown): v is { widget: unknown } {
    return isObj(v) && isObj(v.widget) && typeof (v.widget as Record<string, unknown>).type === 'string';
}

// ── Model-facing description ────────────────────────────────────

function describeKind(kind: PropKind): string {
    switch (kind.k) {
        case 'enum': return kind.values.join('|');
        case 'children': return 'Component[]';
        case 'buttons': return 'Button[]';
        case 'action': return 'Action';
        case 'url': return kind.images ? 'https-url' : 'url';
        case 'scalar': return 'string|number';
        case 'items': return '{title,subtitle?,value?,badge?,badgeColor?,image?,action?}[]';
        case 'options': return '{label,value}[]';
        case 'series': return '{key,label?,color?}[]';
        case 'columns': return '{key,label,align?,format?,currency?}[]';
        case 'rows': return 'object[]';
        case 'data': return 'object[]';
        default: return kind.k;
    }
}

/** A compact reference of every component, for the render_ui tool description. */
export function describeWidgetSpec(): string {
    const lines = WIDGET_TYPES.map((t) => {
        const props = Object.entries(PROPS[t]).map(([n, ps]) => `${n}${ps.required ? '' : '?'}: ${describeKind(ps.kind)}`);
        return `- ${t}${props.length ? ` { ${props.join(', ')} }` : ''}`;
    });
    return [
        'Components (every component is an object with "type" plus these props):',
        ...lines,
        'Action = { type: string, payload?: object, handler?: "agent"|"client" }. With handler "agent" (default) the click comes back to you as the user\'s next message, with any form fields merged into payload by their "name".',
        `Colors: ${COLORS.join('|')}. Formats: ${FORMATS.join('|')} (currency takes an ISO code, e.g. "USD", "NGN").`,
    ].join('\n');
}
