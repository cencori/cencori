export const CUSTOM_SHIKI_THEME = {
  name: 'cencori-premium',
  type: 'dark',
  colors: {
    'editor.background': 'transparent',
    'editor.foreground': '#e8e8e8',
    'editor.lineHighlightBackground': 'rgba(255, 255, 255, 0.04)',
    'editorLineNumber.foreground': 'rgba(255, 255, 255, 0.35)',
    'editorLineNumber.activeForeground': '#ffffff',
    'editor.selectionBackground': 'rgba(96, 165, 250, 0.25)',
    'editor.inactiveSelectionBackground': 'rgba(96, 165, 250, 0.15)',
    'editor.findMatchBackground': 'rgba(236, 72, 153, 0.3)',
    'editor.findMatchHighlightBackground': 'rgba(236, 72, 153, 0.15)',
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment', 'comment.documentation'],
      settings: {
        foreground: '#6b7280',
        fontStyle: 'italic',
      },
    },
    {
      scope: ['string', 'string.quoted', 'string.template', 'string.interpolated'],
      settings: {
        foreground: '#34d399',
      },
    },
    {
      scope: ['string.regexp', 'string.regexp.source'],
      settings: {
        foreground: '#f472b6',
      },
    },
    {
      scope: ['keyword', 'keyword.control', 'keyword.operator', 'storage.type', 'storage.modifier'],
      settings: {
        foreground: '#f472b6',
        fontStyle: 'bold',
      },
    },
    {
      scope: ['keyword.operator.new', 'keyword.operator.typeof', 'keyword.operator.instanceof'],
      settings: {
        foreground: '#f472b6',
      },
    },
    {
      scope: ['entity.name.function', 'support.function', 'variable.function', 'meta.function-call'],
      settings: {
        foreground: '#60a5fa',
      },
    },
    {
      scope: ['entity.name.function', 'support.function', 'variable.function', 'meta.function-call'],
      settings: {
        foreground: '#60a5fa',
      },
    },
    {
      scope: ['entity.name.type', 'support.type', 'entity.name.class', 'entity.name.interface', 'entity.name.enum'],
      settings: {
        foreground: '#a78bfa',
        fontStyle: 'bold',
      },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character'],
      settings: {
        foreground: '#60a5fa',
      },
    },
    {
      scope: ['variable', 'variable.parameter', 'variable.other', 'identifier'],
      settings: {
        foreground: '#fbbf24',
      },
    },
    {
      scope: ['variable.language.this', 'variable.language.super', 'variable.language.arguments'],
      settings: {
        foreground: '#f87171',
      },
    },
    {
      scope: ['punctuation', 'meta.brace', 'meta.delimiter', 'punctuation.separator', 'punctuation.terminator'],
      settings: {
        foreground: '#9ca3af',
      },
    },
    {
      scope: ['punctuation.definition.string', 'punctuation.definition.template-expression'],
      settings: {
        foreground: '#34d399',
      },
    },
    {
      scope: ['support.constant', 'support.variable', 'support.class', 'support.function'],
      settings: {
        foreground: '#60a5fa',
      },
    },
    {
      scope: ['invalid', 'invalid.deprecated'],
      settings: {
        foreground: '#f87171',
      },
    },
    {
      scope: ['markup.heading', 'markup.heading.entity'],
      settings: {
        foreground: '#60a5fa',
        fontStyle: 'bold',
      },
    },
    {
      scope: ['markup.bold', 'markup.strong'],
      settings: {
        foreground: '#ffffff',
        fontStyle: 'bold',
      },
    },
    {
      scope: ['markup.italic', 'markup.emphasis'],
      settings: {
        foreground: '#ffffff',
        fontStyle: 'italic',
      },
    },
    {
      scope: ['markup.code', 'markup.inline.raw'],
      settings: {
        foreground: '#34d399',
      },
    },
    {
      scope: ['markup.link', 'markup.underline.link'],
      settings: {
        foreground: '#60a5fa',
      },
    },
    {
      scope: ['meta.preprocessor', 'meta.preprocessor.string'],
      settings: {
        foreground: '#f472b6',
      },
    },
    {
      scope: ['meta.decorator', 'meta.decorator.punctuation'],
      settings: {
        foreground: '#a78bfa',
      },
    },
    {
      scope: ['tag', 'entity.name.tag'],
      settings: {
        foreground: '#f472b6',
      },
    },
    {
      scope: ['entity.other.attribute-name'],
      settings: {
        foreground: '#60a5fa',
      },
    },
    {
      scope: ['entity.other.attribute-value'],
      settings: {
        foreground: '#34d399',
      },
    },
  ],
};