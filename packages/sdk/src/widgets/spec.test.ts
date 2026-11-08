import { describe, expect, it } from 'vitest';
import { describeWidgetSpec, isWidgetResult, validateWidget } from './spec';

describe('validateWidget', () => {
    it('accepts a card with a chart, table and actions, and drops unknown props', () => {
        const r = validateWidget({
            type: 'Card', title: 'Revenue', glow: true,
            children: [
                { type: 'Chart', chart: 'line', x: 'day', series: [{ key: 'usd', label: 'USD', color: 'accent' }], data: [{ day: 'Mon', usd: 3 }, { day: 'Tue', usd: 5 }] },
                { type: 'Table', columns: [{ key: 'name', label: 'Name' }, { key: 'usd', label: 'USD', align: 'end', format: 'currency', currency: 'USD' }], rows: [{ name: 'Acme', usd: 120 }] },
                { type: 'Form', action: { type: 'save' }, children: [{ type: 'Input', name: 'email', inputType: 'email', required: true }, { type: 'Button', label: 'Save', submit: true }] },
            ],
            actions: [{ type: 'Button', label: 'Open', href: 'https://cencori.com' }],
        });
        expect(r.ok).toBe(true);
        if (r.ok) expect((r.widget as unknown as Record<string, unknown>).glow).toBeUndefined();
    });

    it('reports every problem with its path', () => {
        const r = validateWidget({
            type: 'Card',
            children: [
                { type: 'Carousel' },
                { type: 'Text' },
                { type: 'Badge', label: 'x', color: 'pink' },
                { type: 'Chart', chart: 'bar', x: 'month', series: [{ key: 'rev' }], data: [{ month: 'Jan', revenue: 1 }] },
                { type: 'Button', label: 'Go' },
                { type: 'Image', src: 'javascript:alert(1)' },
            ],
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        const all = r.errors.join('\n');
        expect(all).toContain('widget.children[0]: unknown component type "Carousel"');
        expect(all).toContain('widget.children[1] (Text): missing "value"');
        expect(all).toContain('widget.children[2].color: expected one of');
        expect(all).toContain('series key "rev" is not a key in data');
        expect(all).toContain('(Button): needs an "action"');
        expect(all).toContain('widget.children[5].src: expected an https:// URL');
    });

    it('enforces size limits', () => {
        const rows = Array.from({ length: 300 }, (_, i) => ({ i }));
        const r = validateWidget({ type: 'Table', columns: [{ key: 'i', label: 'i' }], rows });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0]).toContain('more than 200 entries');
        const deep = Array.from({ length: 20 }).reduce<Record<string, unknown>>((child) => ({ type: 'Col', children: [child] }), { type: 'Divider' });
        expect(validateWidget(deep).ok).toBe(false);
    });

    it('recognises a tool result that carries a widget', () => {
        expect(isWidgetResult({ widget: { type: 'Card', children: [] } })).toBe(true);
        expect(isWidgetResult({ widget: 'Card' })).toBe(false);
        expect(isWidgetResult('x')).toBe(false);
    });

    it('describes every component for the model', () => {
        const d = describeWidgetSpec();
        for (const t of ['Card', 'Chart', 'Table', 'Stat', 'Form', 'Select']) expect(d).toContain(`- ${t}`);
    });
});
