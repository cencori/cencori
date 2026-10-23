import type { ReactNode } from 'react';

// Renders an OutRay update body: the editor's document as JSON (ProseMirror /
// TipTap shape). Only the formatting OutRay's editor allows is rendered, as
// React elements, never raw HTML. Anything else degrades to its text.

interface DocNode {
  type?: string;
  text?: string;
  attrs?: { level?: number; href?: string };
  marks?: { type?: string; attrs?: { href?: string } }[];
  content?: DocNode[];
}

/**
 * The document, or null when the body isn't the editor's JSON. OutRay sends it
 * as an object; a JSON string is accepted too.
 */
export function parseUpdateBody(body: unknown): DocNode | null {
  if (!body) return null;
  let doc: DocNode;
  try {
    doc = (typeof body === 'string' ? JSON.parse(body) : body) as DocNode;
  } catch {
    return null;
  }
  return doc?.type === 'doc' && Array.isArray(doc.content) ? doc : null;
}

function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderText(node: DocNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong className="font-semibold">{out}</strong>;
    else if (mark.type === 'italic') out = <em>{out}</em>;
    else if (mark.type === 'link') {
      const href = safeHref(mark.attrs?.href);
      if (href) out = <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{out}</a>;
    }
  }
  return <span key={key}>{out}</span>;
}

function renderChildren(nodes: DocNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) => renderNode(node, index));
}

function renderNode(node: DocNode, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return renderText(node, key);
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return <p key={key}>{renderChildren(node.content)}</p>;
    case 'heading':
      return node.attrs?.level === 2
        ? <h3 key={key} className="pt-2 text-base font-semibold">{renderChildren(node.content)}</h3>
        : <h4 key={key} className="pt-1 text-sm font-semibold">{renderChildren(node.content)}</h4>;
    case 'bulletList':
      return <ul key={key} className="list-disc space-y-1 pl-5">{renderChildren(node.content)}</ul>;
    case 'orderedList':
      return <ol key={key} className="list-decimal space-y-1 pl-5">{renderChildren(node.content)}</ol>;
    case 'listItem':
      return <li key={key}>{renderChildren(node.content)}</li>;
    case 'blockquote':
      return <blockquote key={key} className="border-l-2 border-border pl-3 text-muted-foreground">{renderChildren(node.content)}</blockquote>;
    default:
      return node.content ? <div key={key}>{renderChildren(node.content)}</div> : renderText(node, key);
  }
}

export function UpdateBody({ doc }: { doc: DocNode }) {
  return <div className="space-y-2 text-sm leading-6">{renderChildren(doc.content)}</div>;
}
