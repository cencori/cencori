/**
 * Widgets as they're written: the model writes a widget's JSON a few
 * characters at a time, and these turn whatever has arrived so far into
 * something a chat can draw. The final widget is still checked in full
 * (validateWidget) before it replaces the partial one.
 */

import { WIDGET_TYPES, validateWidget, type WidgetNode } from './spec';

type Frame = 'o' | 'a';

/**
 * Parse the complete part of a JSON document that's still being written.
 * Open strings are closed where they stand (so text grows as it streams),
 * and anything half-written that can't stand on its own (a key without its
 * value, a number cut mid-way) is left out. Returns undefined when nothing
 * usable has arrived yet.
 */
export function parsePartialJson(text: string): unknown {
    const stack: Array<{ t: Frame; expect: 'key' | 'colon' | 'value' | 'comma' }> = [];
    let safe = 0;
    let safeStack = '';
    let inString = false;
    let stringIsKey = false;
    let escaped = false;
    let tokenStart = -1;

    const frames = () => stack.map((f) => f.t).join('');
    const markSafe = (end: number) => { safe = end; safeStack = frames(); };
    const valueDone = (end: number) => {
        const top = stack[stack.length - 1];
        if (top) top.expect = 'comma';
        markSafe(end);
    };

    let i = 0;
    for (; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') {
                inString = false;
                if (stringIsKey) stack[stack.length - 1].expect = 'colon';
                else valueDone(i + 1);
            }
            continue;
        }
        if (tokenStart !== -1 && !/[-+0-9.eEtruefalsn]/.test(c)) {
            if (isCompleteLiteral(text.slice(tokenStart, i))) valueDone(i);
            tokenStart = -1;
        }
        switch (c) {
            case '{': stack.push({ t: 'o', expect: 'key' }); markSafe(i + 1); break;
            case '[': stack.push({ t: 'a', expect: 'value' }); markSafe(i + 1); break;
            case '}': case ']': stack.pop(); valueDone(i + 1); break;
            case '"': {
                const top = stack[stack.length - 1];
                inString = true;
                stringIsKey = Boolean(top && top.t === 'o' && top.expect === 'key');
                break;
            }
            case ':': if (stack.length) stack[stack.length - 1].expect = 'value'; break;
            case ',': if (stack.length) stack[stack.length - 1].expect = stack[stack.length - 1].t === 'o' ? 'key' : 'value'; break;
            default:
                if (tokenStart === -1 && /[-0-9tfn]/.test(c)) tokenStart = i;
        }
    }

    let candidate: string;
    if (inString && !stringIsKey) {
        // A value string mid-way: show what's there. Drop a dangling escape.
        const body = text.replace(/\\u[0-9a-fA-F]{0,3}$|\\$/, '');
        candidate = `${body}"${close(frames())}`;
    } else if (tokenStart !== -1 && isCompleteLiteral(text.slice(tokenStart)) && !/[.eE+-]$/.test(text)) {
        const top = stack[stack.length - 1];
        if (top) top.expect = 'comma';
        candidate = `${text}${close(frames())}`;
    } else {
        candidate = `${text.slice(0, safe)}${close(safeStack)}`;
    }
    if (!candidate.trim()) return undefined;
    try {
        return JSON.parse(candidate);
    } catch {
        try { return JSON.parse(`${text.slice(0, safe)}${close(safeStack)}`); } catch { return undefined; }
    }
}

function isCompleteLiteral(token: string): boolean {
    return token === 'true' || token === 'false' || token === 'null' || /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(token);
}

function close(frames: string): string {
    let out = '';
    for (let i = frames.length - 1; i >= 0; i--) out += frames[i] === 'o' ? '}' : ']';
    return out;
}

const KNOWN = new Set<string>(WIDGET_TYPES);
const ARRAY_PROPS = ['children', 'actions', 'items', 'options', 'series', 'columns', 'rows', 'data'];
const STRING_PROPS: Record<string, string[]> = {
    Text: ['value'], Title: ['value'], Markdown: ['value'], Badge: ['label'], Stat: ['label'],
    Button: ['label'], Input: ['name'], Select: ['name'], Checkbox: ['name', 'label'], Chart: ['x'],
};

/**
 * A widget still being written, made safe to draw: components whose type
 * hasn't arrived (or isn't known) are left out, lists default to empty,
 * missing labels to empty text, and images wait for their full URL.
 * Actions are stripped: a widget can't be used until it's finished.
 */
export function partialWidget(raw: unknown, depth = 0): WidgetNode | null {
    if (depth > 12 || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const node = { ...(raw as Record<string, unknown>) };
    const type = node.type;
    if (typeof type !== 'string' || !KNOWN.has(type)) return null;
    if (type === 'Image') return null;

    for (const key of ARRAY_PROPS) {
        if (key in node || requiresArray(type, key)) {
            node[key] = Array.isArray(node[key]) ? node[key] : [];
        }
    }
    for (const key of STRING_PROPS[type] ?? []) {
        if (typeof node[key] !== 'string') node[key] = '';
    }
    if (type === 'Stat' && typeof node.value !== 'number' && typeof node.value !== 'string') node.value = '';
    for (const key of ['children', 'actions'] as const) {
        if (Array.isArray(node[key])) node[key] = (node[key] as unknown[]).map((c) => partialWidget(c, depth + 1)).filter(Boolean);
    }
    for (const key of ['items', 'options', 'series', 'columns', 'rows', 'data'] as const) {
        if (Array.isArray(node[key])) node[key] = (node[key] as unknown[]).filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    }
    if (type === 'ListView') {
        node.items = (node.items as Array<Record<string, unknown>>).map(({ action: _a, image, ...it }) => ({
            ...it, title: typeof it.title === 'string' ? it.title : '',
            ...(typeof image === 'string' && /^https:\/\/\S+\.\S+/.test(image) ? { image } : {}),
        }));
    }
    if (type === 'Chart' || type === 'Table') {
        const keyed = type === 'Chart' ? 'series' : 'columns';
        node[keyed] = (node[keyed] as Array<Record<string, unknown>>).filter((s) => typeof s.key === 'string');
    }
    delete node.action;
    delete node.href;
    return node as unknown as WidgetNode;
}

function requiresArray(type: string, key: string): boolean {
    switch (type) {
        case 'Card': case 'Row': case 'Col': case 'Form': return key === 'children';
        case 'ListView': return key === 'items';
        case 'Select': return key === 'options';
        case 'Chart': return key === 'series' || key === 'data';
        case 'Table': return key === 'columns' || key === 'rows';
        default: return false;
    }
}

/** The widget inside render_ui's arguments as they stream ({"widget": {...}}). */
export function partialRenderUiWidget(argumentsSoFar: string): WidgetNode | null {
    const parsed = parsePartialJson(argumentsSoFar);
    if (!parsed || typeof parsed !== 'object') return null;
    const raw = 'widget' in (parsed as Record<string, unknown>) ? (parsed as { widget: unknown }).widget : parsed;
    return partialWidget(raw);
}

/**
 * Widget JSON a model wrote into its reply instead of calling render_ui
 * (some models do). Finds it, fenced or bare, even while it's still being
 * written, so the chat can draw it rather than show raw JSON.
 */
export function extractTextWidget(text: string): { before: string; widget: WidgetNode; after: string; complete: boolean } | null {
    const start = text.search(/(```(?:json)?\s*)?\{\s*"(widget|type)"\s*:/);
    if (start === -1) return null;
    const open = text.indexOf('{', start);
    // Find the end of the object, minding strings.
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = open; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') inString = false;
        } else if (c === '"') inString = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) { end = i + 1; break; }
    }
    const json = end === -1 ? text.slice(open) : text.slice(open, end);
    const parsed = parsePartialJson(json);
    if (!parsed || typeof parsed !== 'object') return null;
    const raw = 'widget' in (parsed as Record<string, unknown>) ? (parsed as { widget: unknown }).widget : parsed;
    if (!raw || typeof raw !== 'object' || !KNOWN.has(String((raw as { type?: unknown }).type))) return null;

    let widget: WidgetNode | null = null;
    let complete = false;
    if (end !== -1) {
        const checked = validateWidget(raw);
        if (checked.ok) { widget = checked.widget; complete = true; }
    }
    widget ??= partialWidget(raw);
    if (!widget) return null;
    const after = end === -1 ? '' : text.slice(end).replace(/^\s*```/, '');
    return { before: text.slice(0, start).trimEnd(), widget, after: after.trimStart(), complete };
}
