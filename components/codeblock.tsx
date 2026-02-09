import type { JSX, ReactNode } from 'react';

function getLanguage(className?: string): string {
  if (!className) return 'text';
  const match = className.match(/language-([a-z0-9-]+)/i);
  return match ? match[1] : 'text';
}

interface DocsCodeBlockProps {
  children: ReactNode;
  className?: string;
  filename?: string;
  'aria-label'?: string;
}

export function CodeBlock({ children, className, filename, ...props }: DocsCodeBlockProps): JSX.Element {
  const language = getLanguage(className);

  return (
    <figure
      className="cencori-codeblock relative my-4 rounded-xl border border-white/10 text-white/90"
      aria-label={props['aria-label'] ?? filename ?? 'Code'}
    >
      {(filename || language) && (
        <figcaption className="flex items-center justify-between px-4 py-2 text-xs text-white/60 border-b border-white/10">
          <span className="truncate">{filename ?? 'Code'}</span>
          <span className="ml-3 uppercase tracking-wide">{language}</span>
        </figcaption>
      )}
      <pre className="overflow-auto px-4 py-4 text-[0.875rem] leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    </figure>
  );
}
