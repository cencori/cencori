/**
 * The HTML for the widget's chat: the page the loader frames on customers'
 * sites, and the full-page chat behind an agent's shareable link.
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { orbBackground } from '@/lib/agents/orb';
import type { WidgetAppearance } from './widget';

export type WidgetPageMode = 'widget' | 'inline' | 'page';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function page(opts: { title: string; body: string; ancestors: string[]; nonce: string; status?: number }) {
    const csp = [
        "default-src 'none'",
        `script-src 'self' 'nonce-${opts.nonce}'`,
        "style-src 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        `frame-ancestors ${opts.ancestors.length ? opts.ancestors.join(' ') : "'none'"}`,
    ].join('; ');
    return new NextResponse(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(opts.title)}</title><style>${STYLES}</style></head><body>${opts.body}</body></html>`,
        {
            status: opts.status ?? 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': csp,
                'Cache-Control': 'no-store',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'X-Content-Type-Options': 'nosniff',
            },
        },
    );
}

export function widgetNonce() {
    return crypto.randomBytes(16).toString('base64');
}

export function widgetUnavailablePage(message: string, nonce: string, ancestors: string[] = ['*']) {
    return page({ title: 'Chat unavailable', nonce, ancestors, status: 404, body: `<main class="empty"><p>${escapeHtml(message)}</p></main>` });
}

/** The chat itself; widget-frame.js builds it from the config in the page. */
export function widgetChatPage(opts: {
    key: string;
    agentId: string;
    mode: WidgetPageMode;
    appearance: WidgetAppearance;
    nonce: string;
    ancestors: string[];
    preview?: string | null;
    share?: string | null;
}) {
    const { appearance } = opts;
    const config = { key: opts.key, mode: opts.mode, preview: opts.preview ?? null, share: opts.share ?? null, appearance, orb: orbBackground(opts.agentId) };
    // JSON inside <script> must not be able to close the tag.
    const json = JSON.stringify(config).replace(/</g, '\\u003c');
    const theme = appearance.theme === 'auto' ? '' : ` data-theme="${appearance.theme}"`;
    return page({
        title: appearance.title,
        nonce: opts.nonce,
        ancestors: opts.ancestors,
        body: `<div id="app" class="app mode-${opts.mode}"${theme} style="--accent:${appearance.accent}"></div>`
            + `<script id="cencori-widget-config" type="application/json" nonce="${opts.nonce}">${json}</script>`
            + `<script src="/widget-frame.js" nonce="${opts.nonce}" defer></script>`,
    });
}

const STYLES = `
:root{color-scheme:light dark;--bg:#ffffff;--fg:#111111;--muted:#6b6b6b;--line:#ececec;--soft:#f4f4f3;--bubble:#f1f1f0}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0b;--fg:#f2f2f2;--muted:#9a9a9a;--line:#1f1f1f;--soft:#161616;--bubble:#1b1b1b}}
[data-theme="light"]{--bg:#ffffff;--fg:#111111;--muted:#6b6b6b;--line:#ececec;--soft:#f4f4f3;--bubble:#f1f1f0;color-scheme:light}
[data-theme="dark"]{--bg:#0b0b0b;--fg:#f2f2f2;--muted:#9a9a9a;--line:#1f1f1f;--soft:#161616;--bubble:#1b1b1b;color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:transparent;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.app{display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--fg)}
.empty{display:flex;height:100%;align-items:center;justify-content:center;padding:24px;text-align:center;color:#888;background:#fff}
.head{display:flex;align-items:center;gap:9px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--line)}
.dot{position:relative;width:22px;height:22px;border-radius:50%;background:var(--accent);flex:none;overflow:hidden}
.dot::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.85) 0%,rgba(255,255,255,.25) 22%,transparent 48%);box-shadow:inset 0 -2px 4px rgba(0,0,0,.25)}
.title{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icon{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--muted);cursor:pointer}
.icon:hover{background:var(--soft);color:var(--fg)}
.icon svg{width:16px;height:16px}
.mode-inline .close{display:none}
.mode-page .close{display:none}
.mode-page .head{padding:14px max(16px,calc(50% - 368px))}
.mode-page .list{padding:24px max(16px,calc(50% - 360px))}
.mode-page .composer{margin:0 max(12px,calc(50% - 360px)) 10px}
.list{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:85%;padding:9px 12px;border-radius:14px;word-wrap:break-word;overflow-wrap:anywhere}
.msg p{margin:0 0 8px}.msg p:last-child{margin-bottom:0}
.msg ul,.msg ol{margin:4px 0 8px;padding-left:20px}
.msg code{font:12px ui-monospace,Menlo,monospace;background:var(--soft);padding:1px 4px;border-radius:4px}
.msg a{color:inherit}
.msg sup{font-size:10px;color:var(--muted);margin-left:1px}
.bot{align-self:flex-start;max-width:100%;padding-left:0;padding-right:0}
.user{align-self:flex-end;background:var(--accent);color:var(--accent-fg,#fff);border-bottom-right-radius:4px;white-space:pre-wrap}
.error{align-self:flex-start;color:#c0392b;font-size:13px;padding:2px 4px}
.note{align-self:center;color:var(--muted);font-size:12px;padding:4px 0;text-align:center}
.sources{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.source{display:inline-flex;max-width:100%;align-items:center;gap:4px;padding:2px 8px;border:1px solid var(--line);border-radius:999px;font-size:11px;color:var(--muted);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
a.source:hover{color:var(--fg)}
.typing{padding:9px 0}
.shimmer{position:relative;display:inline-block;color:var(--muted)}
.shimmer::after{content:attr(data-text);position:absolute;inset:0;color:transparent;background-image:linear-gradient(100deg,transparent 30%,var(--fg) 48%,transparent 66%);background-position:180% 50%;background-repeat:no-repeat;background-size:240% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 1.9s linear infinite;pointer-events:none}
@keyframes shimmer{from{background-position:180% 50%}to{background-position:-80% 50%}}
@media (prefers-reduced-motion:reduce){.shimmer::after{animation:none}}
.composer{display:flex;align-items:flex-end;gap:8px;margin:0 12px 8px;padding:6px 6px 6px 12px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}
.composer:focus-within{border-color:var(--muted)}
textarea{flex:1;resize:none;border:0;outline:0;background:transparent;color:inherit;font:inherit;max-height:120px;padding:6px 0}
.send{width:32px;height:32px;border:0;border-radius:10px;background:var(--accent);color:var(--accent-fg,#fff);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}
.send:disabled{opacity:.4;cursor:default}
.send svg{width:16px;height:16px}
.foot{padding:0 0 10px;text-align:center;font-size:11px;color:var(--muted)}
.foot a{color:inherit;text-decoration:none}.foot a:hover{text-decoration:underline}
`;
