import { describe, expect, it } from 'vitest';
import { extractTextWidget, parsePartialJson, partialRenderUiWidget, partialWidget } from './partial';

describe('parsePartialJson', () => {
    it('parses every prefix of a document without throwing, ending with the whole', () => {
        const doc = JSON.stringify({ widget: { type: 'Card', title: 'Revenue "Q4"\n', children: [{ type: 'Stat', label: 'Nov', value: -48210.5, delta: 1e-2 }, { type: 'Text', value: 'ok', truncate: true }, null] } });
        for (let i = 0; i <= doc.length; i++) parsePartialJson(doc.slice(0, i));
        expect(parsePartialJson(doc)).toEqual(JSON.parse(doc));
    });

    it('grows open strings and leaves out half-written keys and numbers', () => {
        expect(parsePartialJson('{"title":"Reve')).toEqual({ title: 'Reve' });
        expect(parsePartialJson('{"a":1,"tit')).toEqual({ a: 1 });
        expect(parsePartialJson('{"a":1,"b":')).toEqual({ a: 1 });
        expect(parsePartialJson('{"a":[1,2,')).toEqual({ a: [1, 2] });
        expect(parsePartialJson('{"a":12.')).toEqual({});
        expect(parsePartialJson('{"a":tr')).toEqual({});
        expect(parsePartialJson('{"a":"x\\')).toEqual({ a: 'x' });
        expect(parsePartialJson('')).toBeUndefined();
    });
});

describe('partialWidget', () => {
    it('keeps what can be drawn and strips actions', () => {
        const w = partialRenderUiWidget('{"widget":{"type":"Card","title":"Q4","children":[{"type":"Stat","label":"Rev","value":4821},{"type":"Chart","chart":"bar","x":"m","series":[{"key":"r"}],"data":[{"m":"Oct","r":1}');
        expect(w).toEqual({
            type: 'Card', title: 'Q4', children: [
                { type: 'Stat', label: 'Rev', value: 4821 },
                { type: 'Chart', chart: 'bar', x: 'm', series: [{ key: 'r' }], data: [{ m: 'Oct', r: 1 }] },
            ],
        });
        expect(partialWidget({ type: 'Button', label: 'Go', action: { type: 'go' } })).toEqual({ type: 'Button', label: 'Go' });
        expect(partialWidget({ type: 'Card', children: [{ type: 'Te' }, { type: 'Image', src: 'https://x' }] })).toEqual({ type: 'Card', children: [] });
        expect(partialWidget({ ty: 'Card' })).toBeNull();
    });
});

describe('extractTextWidget', () => {
    const json = JSON.stringify({ widget: { type: 'Card', title: 'Top', children: [{ type: 'Text', value: 'hi' }] } }, null, 2);
    it('finds widget JSON written as text, fenced or bare', () => {
        const fenced = extractTextWidget(`Here you go:\n\`\`\`json\n${json}\n\`\`\`\nAnything else?`)!;
        expect(fenced).toMatchObject({ before: 'Here you go:', after: 'Anything else?', complete: true, widget: { type: 'Card', title: 'Top' } });
        expect(extractTextWidget(`Here:\n${json}`)).toMatchObject({ before: 'Here:', after: '', complete: true });
    });
    it('draws it while it is still being written', () => {
        const half = extractTextWidget(`Here:\n${json.slice(0, json.indexOf('"children"') + 15)}`)!;
        expect(half.complete).toBe(false);
        expect(half.widget).toMatchObject({ type: 'Card', title: 'Top' });
    });
    it('leaves ordinary JSON and text alone', () => {
        expect(extractTextWidget('no widgets here')).toBeNull();
        expect(extractTextWidget('{"type": "invoice", "id": 1}')).toBeNull();
    });
});
