export const CUSTOM_SHIKI_THEME = {
    name: 'cencori-custom',
    type: 'dark',
    colors: {
        'editor.background': 'transparent',
        'editor.foreground': '#e5e7eb',
    },
    tokenColors: [
        { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6f6f71ff' } }, // grey
        { scope: ['string', 'string.quoted', 'string.template'], settings: { foreground: '#22c55e' } }, // green
        { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#ec4899' } }, // pink
        { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#60a5fa' } }, // blue
        { scope: ['entity.name.type', 'support.type', 'entity.name.class'], settings: { foreground: '#a78bfa' } }, // purple
        { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#60a5fa' } }, // blue
        { scope: ['variable', 'identifier'], settings: { foreground: '#ff9500ff' } }, // blue tint
        { scope: ['punctuation', 'meta.brace', 'meta.delimiter'], settings: { foreground: '#9ca3af' } }, // grey
    ],
};
