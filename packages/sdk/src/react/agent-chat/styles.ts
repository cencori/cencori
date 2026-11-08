import type { CSSProperties } from 'react';

/**
 * <AgentChat> ships its own stylesheet (scoped to .cen-chat) so it looks right
 * in any app, with or without Tailwind. Everything reads CSS variables: set
 * them on a parent, or pass `theme`.
 */

export interface AgentChatTheme {
    /** 'auto' follows the system. Default 'auto'. */
    colorScheme?: 'light' | 'dark' | 'auto';
    /** Buttons, links, the user's messages and the first chart series. Any CSS color. */
    accent?: string;
    /** Text on the accent color. Default white. */
    accentForeground?: string;
    /** Corner rounding. Default 'md'. */
    radius?: 'none' | 'sm' | 'md' | 'lg' | number;
    density?: 'compact' | 'normal';
    fontFamily?: string;
}

const RADIUS = { none: 0, sm: 4, md: 8, lg: 14 } as const;

export function themeStyle(theme: AgentChatTheme = {}): CSSProperties {
    const radius = typeof theme.radius === 'number' ? theme.radius : RADIUS[theme.radius ?? 'md'];
    const vars: Record<string, string> = { '--cen-radius': `${radius}px` };
    if (theme.accent) {
        vars['--cen-accent'] = theme.accent;
        vars['--cen-accent-fg'] = theme.accentForeground ?? '#ffffff';
    }
    if (theme.fontFamily) vars['--cen-font'] = theme.fontFamily;
    if (theme.density === 'compact') vars['--cen-gap'] = '10px';
    return vars as CSSProperties;
}

const LIGHT = `
  --cen-bg: #ffffff;
  --cen-fg: #0a0a0a;
  --cen-muted: #f5f5f5;
  --cen-muted-fg: #737373;
  --cen-border: #e5e5e5;
  --cen-surface: #ffffff;
  --cen-user-bg: #f0f0f0;
  --cen-user-fg: #0a0a0a;
  --cen-success: #16a34a;
  --cen-warning: #d97706;
  --cen-danger: #dc2626;
  --cen-info: #2563eb;
  --cen-chart-2: #0ea5e9;
  --cen-chart-3: #f59e0b;
  --cen-chart-4: #10b981;
  --cen-chart-5: #8b5cf6;
  --cen-chart-6: #ef4444;
`;
const DARK = `
  --cen-bg: #0a0a0a;
  --cen-fg: #fafafa;
  --cen-muted: #171717;
  --cen-muted-fg: #a3a3a3;
  --cen-border: #262626;
  --cen-surface: #111111;
  --cen-user-bg: #1f1f1f;
  --cen-user-fg: #fafafa;
  --cen-success: #22c55e;
  --cen-warning: #f59e0b;
  --cen-danger: #ef4444;
  --cen-info: #60a5fa;
  --cen-chart-2: #38bdf8;
  --cen-chart-3: #fbbf24;
  --cen-chart-4: #34d399;
  --cen-chart-5: #a78bfa;
  --cen-chart-6: #f87171;
`;

export const AGENT_CHAT_CSS = `
.cen-chat {
  --cen-accent: #0a0a0a;
  --cen-accent-fg: #ffffff;
  --cen-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --cen-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --cen-gap: 16px;
  ${LIGHT}
  display: flex; flex-direction: column; min-height: 0; height: 100%;
  background: var(--cen-bg); color: var(--cen-fg);
  font-family: var(--cen-font); font-size: 14px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.cen-chat[data-scheme="dark"] { ${DARK} --cen-accent: #fafafa; --cen-accent-fg: #0a0a0a; }
@media (prefers-color-scheme: dark) {
  .cen-chat[data-scheme="auto"] { ${DARK} --cen-accent: #fafafa; --cen-accent-fg: #0a0a0a; }
}
.cen-chat *, .cen-chat *::before, .cen-chat *::after { box-sizing: border-box; }
.cen-chat button { font: inherit; color: inherit; cursor: pointer; }
.cen-chat button:disabled { cursor: not-allowed; opacity: .55; }

.cen-transcript { flex: 1; min-height: 0; overflow-y: auto; padding: var(--cen-gap); display: flex; flex-direction: column; gap: var(--cen-gap); }
.cen-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; padding: 24px; }
.cen-empty-title { font-size: 18px; font-weight: 600; }
.cen-prompts { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 520px; }
.cen-prompt { border: 1px solid var(--cen-border); background: var(--cen-surface); border-radius: var(--cen-radius); padding: 7px 12px; font-size: 13px; text-align: left; }
.cen-prompt:hover { background: var(--cen-muted); }

.cen-msg { display: flex; flex-direction: column; gap: 10px; max-width: 100%; }
.cen-msg-user { align-items: flex-end; }
.cen-bubble { background: var(--cen-user-bg); color: var(--cen-user-fg); padding: 8px 12px; border-radius: var(--cen-radius); max-width: 85%; white-space: pre-wrap; overflow-wrap: anywhere; }
.cen-action-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--cen-border); border-radius: var(--cen-radius); padding: 5px 10px; font-size: 12px; color: var(--cen-muted-fg); }
.cen-agent-label { font-size: 12px; color: var(--cen-muted-fg); font-weight: 500; }
.cen-text { overflow-wrap: anywhere; }
.cen-text p { margin: 0 0 8px; } .cen-text p:last-child { margin-bottom: 0; }
.cen-text ul, .cen-text ol { margin: 0 0 8px; padding-left: 20px; }
.cen-text code { font-family: var(--cen-mono); font-size: 12.5px; background: var(--cen-muted); padding: 1px 4px; border-radius: 4px; }
.cen-text pre { font-family: var(--cen-mono); font-size: 12.5px; background: var(--cen-muted); padding: 10px 12px; border-radius: var(--cen-radius); overflow-x: auto; margin: 0 0 8px; }
.cen-text pre code { background: none; padding: 0; }
.cen-text a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.cen-cursor { display: inline-block; width: 7px; height: 14px; margin-left: 2px; vertical-align: -2px; background: var(--cen-fg); animation: cen-blink 1s steps(2) infinite; }
@keyframes cen-blink { 50% { opacity: 0; } }
.cen-thinking { display: inline-flex; gap: 4px; padding: 6px 0; }
.cen-thinking span { width: 6px; height: 6px; border-radius: 50%; background: var(--cen-muted-fg); animation: cen-pulse 1.2s infinite ease-in-out; }
.cen-thinking span:nth-child(2) { animation-delay: .15s; } .cen-thinking span:nth-child(3) { animation-delay: .3s; }
@keyframes cen-pulse { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }

.cen-step { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--cen-muted-fg); }
.cen-step-toggle { background: none; border: 0; padding: 0; display: inline-flex; align-items: center; gap: 8px; color: inherit; }
.cen-step-detail { margin-top: 6px; font-family: var(--cen-mono); font-size: 11.5px; background: var(--cen-muted); border-radius: var(--cen-radius); padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; }
.cen-spinner { width: 12px; height: 12px; border: 1.5px solid var(--cen-border); border-top-color: var(--cen-muted-fg); border-radius: 50%; animation: cen-spin .8s linear infinite; }
@keyframes cen-spin { to { transform: rotate(360deg); } }
.cen-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--cen-success); }

.cen-approval { border: 1px solid var(--cen-border); border-radius: var(--cen-radius); background: var(--cen-surface); overflow: hidden; }
.cen-approval-head { padding: 10px 12px; font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--cen-border); }
.cen-approval-item { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.cen-approval-item + .cen-approval-item { border-top: 1px solid var(--cen-border); }
.cen-approval-args { font-family: var(--cen-mono); font-size: 11.5px; color: var(--cen-muted-fg); white-space: pre-wrap; overflow-wrap: anywhere; }
.cen-approval-actions { display: flex; gap: 8px; }
.cen-decided { font-size: 12.5px; color: var(--cen-muted-fg); }

.cen-error { margin: 0 var(--cen-gap); padding: 8px 12px; border: 1px solid color-mix(in srgb, var(--cen-danger) 40%, transparent); color: var(--cen-danger); border-radius: var(--cen-radius); font-size: 13px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.cen-composer { padding: 12px var(--cen-gap) var(--cen-gap); }
.cen-composer-box { display: flex; align-items: flex-end; gap: 8px; border: 1px solid var(--cen-border); border-radius: var(--cen-radius); background: var(--cen-surface); padding: 6px 6px 6px 12px; }
.cen-composer-box:focus-within { border-color: color-mix(in srgb, var(--cen-fg) 35%, var(--cen-border)); }
.cen-composer textarea { flex: 1; resize: none; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; padding: 6px 0; max-height: 160px; min-height: 22px; }
.cen-composer textarea::placeholder { color: var(--cen-muted-fg); }
.cen-chat .cen-send { width: 32px; height: 32px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: calc(var(--cen-radius) - 2px); background: var(--cen-accent); color: var(--cen-accent-fg); }

/* Widgets */
.cen-w-card { border: 1px solid var(--cen-border); border-radius: var(--cen-radius); background: var(--cen-surface); overflow: hidden; }
.cen-w-card-head { padding: 12px 14px 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.cen-w-card-title { font-weight: 600; font-size: 14px; }
.cen-w-card-sub { font-size: 12.5px; color: var(--cen-muted-fg); }
.cen-w-card-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 12px; }
.cen-w-card-actions { padding: 10px 14px; border-top: 1px solid var(--cen-border); display: flex; flex-wrap: wrap; gap: 8px; }
.cen-w-row { display: flex; flex-direction: row; }
.cen-w-col { display: flex; flex-direction: column; min-width: 0; }
.cen-w-divider { height: 1px; background: var(--cen-border); width: 100%; }
.cen-w-spacer { flex: 1; }
.cen-w-title { font-weight: 600; margin: 0; }
.cen-w-badge { display: inline-flex; align-items: center; font-size: 11.5px; font-weight: 500; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--cen-border); white-space: nowrap; }
.cen-w-image { display: block; width: 100%; border-radius: calc(var(--cen-radius) - 2px); background: var(--cen-muted); }
.cen-w-stat-label { font-size: 12.5px; color: var(--cen-muted-fg); }
.cen-w-stat-value { font-size: 24px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.cen-w-stat-delta { font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; }
.cen-w-table-wrap { overflow-x: auto; border: 1px solid var(--cen-border); border-radius: calc(var(--cen-radius) - 2px); }
.cen-w-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cen-w-table th { text-align: left; font-weight: 500; color: var(--cen-muted-fg); font-size: 12px; padding: 7px 10px; background: var(--cen-muted); white-space: nowrap; }
.cen-w-table td { padding: 7px 10px; border-top: 1px solid var(--cen-border); font-variant-numeric: tabular-nums; }
.cen-w-list { display: flex; flex-direction: column; }
.cen-w-list-item { display: flex; align-items: center; gap: 10px; padding: 9px 0; text-align: left; background: none; border: 0; width: 100%; }
.cen-w-list-item + .cen-w-list-item { border-top: 1px solid var(--cen-border); }
button.cen-w-list-item:hover { background: var(--cen-muted); }
.cen-w-list-thumb { width: 36px; height: 36px; border-radius: calc(var(--cen-radius) - 2px); object-fit: cover; background: var(--cen-muted); flex-shrink: 0; }
.cen-w-list-main { flex: 1; min-width: 0; }
.cen-w-list-title { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cen-w-list-sub { font-size: 12.5px; color: var(--cen-muted-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cen-w-list-value { font-variant-numeric: tabular-nums; font-weight: 500; }
.cen-w-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: calc(var(--cen-radius) - 2px); border: 1px solid transparent; font-weight: 500; text-decoration: none; white-space: nowrap; height: 32px; padding: 0 12px; font-size: 13px; }
.cen-w-btn[data-size="sm"] { height: 28px; padding: 0 10px; font-size: 12.5px; }
.cen-w-btn[data-block="true"] { width: 100%; }
.cen-w-btn[data-variant="primary"] { background: var(--cen-accent); color: var(--cen-accent-fg); }
.cen-w-btn[data-variant="secondary"] { background: var(--cen-muted); color: var(--cen-fg); }
.cen-w-btn[data-variant="outline"] { border-color: var(--cen-border); background: var(--cen-surface); color: var(--cen-fg); }
.cen-w-btn[data-variant="ghost"] { background: transparent; color: var(--cen-fg); }
.cen-w-btn[data-variant="danger"] { background: var(--cen-danger); color: #fff; }
.cen-w-btn:hover:not(:disabled) { filter: brightness(0.95); }
.cen-w-form { display: flex; flex-direction: column; gap: 10px; }
.cen-w-field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; }
.cen-w-field > span { color: var(--cen-muted-fg); font-weight: 500; }
.cen-w-input { font: inherit; font-size: 13.5px; color: var(--cen-fg); background: var(--cen-surface); border: 1px solid var(--cen-border); border-radius: calc(var(--cen-radius) - 2px); padding: 7px 10px; outline: 0; width: 100%; }
.cen-w-input:focus { border-color: color-mix(in srgb, var(--cen-fg) 35%, var(--cen-border)); }
.cen-w-check { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; }
.cen-w-chart { width: 100%; }
.cen-w-chart svg { display: block; width: 100%; overflow: visible; }
.cen-w-chart text { fill: var(--cen-muted-fg); font-size: 11px; font-family: var(--cen-font); }
.cen-w-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--cen-muted-fg); margin-top: 8px; }
.cen-w-legend span { display: inline-flex; align-items: center; gap: 6px; }
.cen-w-legend i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.cen-w-tooltip { position: absolute; pointer-events: none; background: var(--cen-fg); color: var(--cen-bg); font-size: 12px; padding: 6px 8px; border-radius: 6px; white-space: nowrap; transform: translate(-50%, calc(-100% - 8px)); z-index: 2; }
.cen-w-done { opacity: .6; pointer-events: none; }
`;
