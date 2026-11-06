// `shiki` for the bundler, with only the languages and themes we show.
//
// The full `shiki` entry registers ~300 grammars as lazy imports, so webpack
// compiled every one of them into the build (about 140MB of input across the
// docs, academy and blog routes), even though our pages use ~25. It was a large
// part of why the production build went over Brimble's memory limit
// (2026-11-06). next.config.ts aliases `shiki` to this file, for our code and
// for packages such as rehype-pretty-code.
//
// To support another language or theme, add it to LANGS or THEMES below. An
// unknown language renders as plain text.
import {
  createHighlighterCore,
  type HighlighterCore,
  type LanguageInput,
  type ThemeInput,
  type ThemeRegistrationAny,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export * from "shiki/core";
export { createJavaScriptRegexEngine };

const LANGS = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  bash: () => import("@shikijs/langs/bash"),
  python: () => import("@shikijs/langs/python"),
  http: () => import("@shikijs/langs/http"),
  go: () => import("@shikijs/langs/go"),
  html: () => import("@shikijs/langs/html"),
  css: () => import("@shikijs/langs/css"),
  php: () => import("@shikijs/langs/php"),
  yaml: () => import("@shikijs/langs/yaml"),
  toml: () => import("@shikijs/langs/toml"),
  rust: () => import("@shikijs/langs/rust"),
  markdown: () => import("@shikijs/langs/markdown"),
  diff: () => import("@shikijs/langs/diff"),
  sql: () => import("@shikijs/langs/sql"),
  solidity: () => import("@shikijs/langs/solidity"),
  ruby: () => import("@shikijs/langs/ruby"),
  java: () => import("@shikijs/langs/java"),
  csharp: () => import("@shikijs/langs/csharp"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  swift: () => import("@shikijs/langs/swift"),
  dockerfile: () => import("@shikijs/langs/dockerfile"),
  dotenv: () => import("@shikijs/langs/dotenv"),
  graphql: () => import("@shikijs/langs/graphql"),
  xml: () => import("@shikijs/langs/xml"),
} satisfies Record<string, () => Promise<{ default: LanguageInput }>>;

const LANG_ALIASES: Record<string, keyof typeof LANGS> = {
  ts: "typescript", js: "javascript", mjs: "javascript", cjs: "javascript",
  sh: "bash", shell: "bash", shellscript: "bash", zsh: "bash", console: "bash", terminal: "bash",
  py: "python", golang: "go", yml: "yaml", md: "markdown", mdx: "markdown",
  rs: "rust", rb: "ruby", cs: "csharp", "c#": "csharp", kt: "kotlin",
  docker: "dockerfile", env: "dotenv", gql: "graphql", sol: "solidity",
};

const PLAIN = new Set(["text", "txt", "plaintext", "plain", "ansi", ""]);

const THEMES = {
  "min-light": () => import("@shikijs/themes/min-light"),
  vesper: () => import("@shikijs/themes/vesper"),
  "one-light": () => import("@shikijs/themes/one-light"),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro"),
  "github-dark-dimmed": () => import("@shikijs/themes/github-dark-dimmed"),
  "github-light": () => import("@shikijs/themes/github-light"),
  "github-dark": () => import("@shikijs/themes/github-dark"),
} satisfies Record<string, () => Promise<{ default: ThemeRegistrationAny }>>;

export const bundledLanguages = LANGS;
export const bundledThemes = THEMES;
export type BundledLanguage = keyof typeof LANGS | keyof typeof LANG_ALIASES;
export type BundledTheme = keyof typeof THEMES;

function langName(lang: unknown): keyof typeof LANGS | "text" | null {
  if (typeof lang !== "string") return null;
  const key = lang.toLowerCase();
  if (PLAIN.has(key)) return "text";
  if (key in LANGS) return key as keyof typeof LANGS;
  return LANG_ALIASES[key] ?? null;
}

function langInput(lang: unknown): LanguageInput | null {
  if (lang && typeof lang === "object") return lang as LanguageInput;
  if (typeof lang === "function") return lang as LanguageInput;
  const name = langName(lang);
  return name && name !== "text" ? LANGS[name] : null;
}

function themeInput(theme: unknown): ThemeInput | null {
  if (theme && typeof theme === "object") return theme as ThemeInput;
  if (typeof theme === "string" && theme in THEMES) return THEMES[theme as BundledTheme];
  return null;
}

type Options = { langs?: unknown[]; themes?: unknown[]; [key: string]: unknown };

/** A core highlighter that accepts our language and theme names. */
export async function createHighlighter(options: Options = {}): Promise<HighlighterCore> {
  const highlighter = await createHighlighterCore({
    engine: createJavaScriptRegexEngine({ forgiving: true }),
    langs: (options.langs ?? []).map(langInput).filter((l): l is LanguageInput => l !== null),
    themes: (options.themes ?? []).map(themeInput).filter((t): t is ThemeInput => t !== null),
  });
  const loadLanguage = highlighter.loadLanguage.bind(highlighter);
  const loadTheme = highlighter.loadTheme.bind(highlighter);
  // Names we don't ship are skipped, so callers fall back to plain text.
  highlighter.loadLanguage = (...langs) =>
    loadLanguage(...langs.map(langInput).filter((l): l is LanguageInput => l !== null));
  highlighter.loadTheme = (...themes) =>
    loadTheme(...themes.map(themeInput).filter((t): t is ThemeInput => t !== null));
  return highlighter;
}

let singleton: Promise<HighlighterCore> | null = null;

/** Shared highlighter; loads any requested languages and themes it lacks. */
export async function getSingletonHighlighter(options: Options = {}): Promise<HighlighterCore> {
  singleton ??= createHighlighter();
  const highlighter = await singleton;
  await Promise.all([
    highlighter.loadLanguage(...((options.langs ?? []) as LanguageInput[])),
    highlighter.loadTheme(...((options.themes ?? []) as ThemeInput[])),
  ]);
  return highlighter;
}

type CodeOptions = Parameters<HighlighterCore["codeToHtml"]>[1];

async function ready(options: CodeOptions) {
  const o = options as { lang?: unknown; theme?: unknown; themes?: Record<string, unknown> };
  const themes = [o.theme, ...Object.values(o.themes ?? {})].filter(Boolean);
  const highlighter = await getSingletonHighlighter({ langs: [o.lang], themes });
  const name = langName(o.lang);
  const loaded = typeof o.lang === "string" && highlighter.getLoadedLanguages().includes(o.lang);
  const lang = loaded ? o.lang : name && name !== "text" ? name : "text";
  return { highlighter, options: { ...options, lang } as CodeOptions };
}

export async function codeToHtml(code: string, options: CodeOptions): Promise<string> {
  const { highlighter, options: o } = await ready(options);
  return highlighter.codeToHtml(code, o);
}

export async function codeToHast(code: string, options: CodeOptions) {
  const { highlighter, options: o } = await ready(options);
  return highlighter.codeToHast(code, o);
}

export async function codeToTokens(code: string, options: CodeOptions) {
  const { highlighter, options: o } = await ready(options);
  return highlighter.codeToTokens(code, o);
}
