import type { ReactNode } from 'react';

/**
 * A small Markdown renderer for agent replies: paragraphs, headings, lists,
 * code, bold, italics and links. It builds React elements, never HTML
 * strings, so a reply can't inject markup.
 */
export function Markdown({ text }: { text: string }) {
    return <>{blocks(text)}</>;
}

function blocks(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    let i = 0;
    let key = 0;
    while (i < lines.length) {
        const line = lines[i];
        const fence = line.match(/^```(\w*)\s*$/);
        if (fence) {
            const code: string[] = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
            i++;
            out.push(<pre key={key++}><code>{code.join('\n')}</code></pre>);
            continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
            out.push(<p key={key++} style={{ fontWeight: 600, fontSize: heading[1].length <= 2 ? 16 : 14 }}>{inline(heading[2])}</p>);
            i++;
            continue;
        }
        if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
            const ordered = /^\s*\d+[.)]\s+/.test(line);
            const items: string[] = [];
            while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
                i++;
            }
            const children = items.map((it, k) => <li key={k}>{inline(it)}</li>);
            out.push(ordered ? <ol key={key++}>{children}</ol> : <ul key={key++}>{children}</ul>);
            continue;
        }
        if (!line.trim()) { i++; continue; }
        const para: string[] = [];
        while (i < lines.length && lines[i].trim() && !/^```|^#{1,4}\s|^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++]);
        out.push(<p key={key++}>{para.flatMap((p, k) => (k ? [<br key={`b${k}`} />, ...inline(p)] : inline(p)))}</p>);
    }
    return out;
}

function inline(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const t = m[0];
        if (m[1]) out.push(<code key={key++}>{t.slice(1, -1)}</code>);
        else if (m[2] || m[3]) out.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
        else if (m[4]) out.push(<em key={key++}>{t.slice(1, -1)}</em>);
        else if (m[5]) {
            const label = t.slice(1, t.indexOf(']('));
            out.push(<a key={key++} href={m[6]} target="_blank" rel="noopener noreferrer">{label}</a>);
        }
        last = m.index + t.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}
