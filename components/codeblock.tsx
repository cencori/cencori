import { highlightCode, stripCodeAnnotations } from "@/lib/docs/highlight-code";
import { cn } from "@/lib/utils";
import { CopyButton } from "./codeblock-copy-button";

function dedent(code: string): string {
  const lines = code.split('\n');
  const indent = lines.reduce((min, line) => {
    if (line.trim() === '') return min;
    const leading = line.match(/^[ \t]*/)?.[0] ?? '';
    return Math.min(min, leading.length);
  }, Infinity);
  if (indent === 0 || !isFinite(indent)) return code;
  return lines.map(l => l.slice(indent)).join('\n');
}

function getLanguageFromClass(className?: string): string {
  if (!className) return 'text';
  const match = className.match(/language-([a-z0-9-]+)/i);
  return match ? match[1] : 'text';
}

const SUPPORTED_LANGUAGES = new Set([
  'bash', 'c', 'cpp', 'css', 'diff', 'docker', 'go', 'graphql', 'html',
  'java', 'javascript', 'js', 'jsx', 'json', 'kotlin', 'markdown', 'md',
  'python', 'py', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift',
  'text', 'toml', 'ts', 'tsx', 'typescript', 'xml', 'yaml', 'yml',
]);

function safeLanguage(lang: string): string {
  return SUPPORTED_LANGUAGES.has(lang) ? lang : 'text';
}

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export async function CodeBlock({
  code,
  language: languageProp,
  className,
}: CodeBlockProps) {
  const language = safeLanguage(languageProp || getLanguageFromClass(className));
  const dedented = dedent(code);
  const trimmed = dedented.replace(/\n+$/, '');
  const cleanedCode = stripCodeAnnotations(trimmed);
  const highlightedCode = await highlightCode(trimmed, language, { showLineNumbers: false });

  return (
    <figure
      className={cn(
        "codeblock relative w-full max-w-full",
        "rounded-2xl border border-border/40",
        "overflow-hidden transition-all duration-300",
        "hover:border-border/60 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]",
      )}
      aria-label="Code block"
    >
      <div className="relative group [&_pre]:!bg-transparent [&_pre]:!border-0 [&_pre]:!rounded-none [&_pre]:!px-4 [&_pre]:!py-2.5">
        <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        <CopyButton code={cleanedCode} />
      </div>
      <style>{`
        .codeblock pre::-webkit-scrollbar { height: 8px; }
        .codeblock pre::-webkit-scrollbar-track { background: transparent; }
        .codeblock pre::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .codeblock pre::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.4);
        }
        .codeblock code { tab-size: 2; }
      `}</style>
    </figure>
  );
}
