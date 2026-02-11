"use client";

import { Copy } from "lucide-react";
import React from "react";
import { toast } from "sonner";

// Simple syntax highlighter
function highlightCode(code: string, lang: string) {
    if (!code) return code;

    // Basic tokens for JS/TS/Python/Go
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|class|processed|interface|type|public|private|protected|try|catch|finally|def|class|return|in|is|not|and|or|print)\b/g;
    const strings = /("[^"]*"|'[^']*'|`[^`]*`)/g;
    const numbers = /\b\d+\b/g;
    const comments = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g;
    const functions = /\b([a-zA-Z_]\w*)(?=\()/g;
    const brackets = /([{}[\],])/g;

    // Minimal tokenizer with light/dark mode support
    const tokenizers = [
        { type: "comment", regex: comments, color: "text-slate-500 dark:text-slate-400" },
        { type: "string", regex: strings, color: "text-green-600 dark:text-green-400" },
        { type: "keyword", regex: keywords, color: "text-purple-600 dark:text-purple-400" },
        { type: "function", regex: functions, color: "text-blue-600 dark:text-blue-400" },
        { type: "number", regex: numbers, color: "text-orange-600 dark:text-orange-400" },
        { type: "bracket", regex: brackets, color: "text-yellow-600 dark:text-yellow-500" },
    ];

    let segments: { text: string; color?: string }[] = [{ text: code }];

    for (const token of tokenizers) {
        const newSegments: { text: string; color?: string }[] = [];
        for (const segment of segments) {
            if (segment.color) {
                newSegments.push(segment);
                continue;
            }

            let lastIndex = 0;
            // Reset regex state
            token.regex.lastIndex = 0;

            const text = segment.text;
            const matches = Array.from(text.matchAll(token.regex));

            if (matches.length === 0) {
                newSegments.push(segment);
                continue;
            }

            for (const m of matches) {
                if (m.index! > lastIndex) {
                    newSegments.push({ text: text.slice(lastIndex, m.index!) });
                }
                newSegments.push({ text: m[0], color: token.color });
                lastIndex = m.index! + m[0].length;
            }
            if (lastIndex < text.length) {
                newSegments.push({ text: text.slice(lastIndex) });
            }
        }
        segments = newSegments;
    }

    return segments.map((s, i) => (
        <span key={i} className={s.color || "text-foreground"}>{s.text}</span>
    ));
}

export function MarkdownRenderer({ content }: { content: string }) {
    // Process the text line by line for better control
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent = "";
    let codeLanguage = "";
    let listItems: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let listKey = 0;

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success("Code copied", { duration: 2000 });
    };

    const flushList = () => {
        if (listItems.length > 0 && listType) {
            const ListComponent = listType === "ol" ? "ol" : "ul";
            elements.push(
                <ListComponent key={`list-${elements.length}-${listKey++}`} className={listType === "ol" ? "list-decimal ml-4 my-2" : "list-disc ml-4 my-2"}>
                    {listItems.map((item, i) => (
                        <li key={i} className="text-sm text-foreground/90">{processInline(item)}</li>
                    ))}
                </ListComponent>
            );
            listItems = [];
            listType = null;
        }
    };

    const processInline = (line: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let remaining = line;
        let key = 0;

        while (remaining.length > 0) {
            const codeMatch = remaining.match(/`([^`]+)`/);
            const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
            const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

            const matches = [
                codeMatch ? { type: "code", match: codeMatch, index: codeMatch.index! } : null,
                boldMatch ? { type: "bold", match: boldMatch, index: boldMatch.index! } : null,
                linkMatch ? { type: "link", match: linkMatch, index: linkMatch.index! } : null,
            ].filter(Boolean).sort((a, b) => a!.index - b!.index);

            if (matches.length === 0) {
                parts.push(remaining);
                break;
            }

            const first = matches[0]!;
            if (first.index > 0) {
                parts.push(remaining.slice(0, first.index));
            }

            if (first.type === "code") {
                parts.push(<code key={`inline-${key++}`} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary font-medium">{first.match![1]}</code>);
                remaining = remaining.slice(first.index + first.match![0].length);
            } else if (first.type === "bold") {
                parts.push(<strong key={`bold-${key++}`} className="font-semibold">{first.match![1]}</strong>);
                remaining = remaining.slice(first.index + first.match![0].length);
            } else if (first.type === "link") {
                parts.push(<a key={`link-${key++}`} href={first.match![2]} className="text-primary hover:underline font-medium" target="_blank" rel="noopener">{first.match![1]}</a>);
                remaining = remaining.slice(first.index + first.match![0].length);
            }
        }

        return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith("```")) {
            if (!inCodeBlock) {
                flushList();
                inCodeBlock = true;
                codeLanguage = line.slice(3).trim();
                codeContent = "";
            } else {
                elements.push(
                    <div key={`code-${elements.length}`} className="my-3 rounded-lg overflow-hidden border border-border/50 bg-muted/30 dark:bg-[#1e1e1e]">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 dark:bg-white/5 border-b border-border/50 dark:border-white/5">
                            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{codeLanguage || "code"}</span>
                            <button onClick={() => copyCode(codeContent)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <Copy className="h-3 w-3" />
                            </button>
                        </div>
                        <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
                            <code>{highlightCode(codeContent.trim(), codeLanguage)}</code>
                        </pre>
                    </div>
                );
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent += (codeContent ? "\n" : "") + line;
            continue;
        }

        const olMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (olMatch) {
            if (listType !== "ol") flushList();
            listType = "ol";
            listItems.push(olMatch[2]);
            continue;
        }

        const ulMatch = line.match(/^[-*]\s+(.+)/);
        if (ulMatch) {
            if (listType !== "ul") flushList();
            listType = "ul";
            listItems.push(ulMatch[1]);
            continue;
        }

        flushList();

        if (!line.trim()) {
            elements.push(<div key={`spacer-${elements.length}`} className="h-2" />);
            continue;
        }

        if (line.startsWith("### ")) {
            elements.push(<h4 key={`h4-${elements.length}`} className="font-semibold text-sm mt-4 mb-2">{line.slice(4)}</h4>);
            continue;
        }
        if (line.startsWith("## ")) {
            elements.push(<h3 key={`h3-${elements.length}`} className="font-semibold text-base mt-5 mb-2">{line.slice(3)}</h3>);
            continue;
        }
        if (line.startsWith("# ")) {
            elements.push(<h2 key={`h2-${elements.length}`} className="font-bold text-lg mt-6 mb-3">{line.slice(2)}</h2>);
            continue;
        }

        elements.push(<p key={`p-${elements.length}`} className="text-sm text-foreground/90 leading-relaxed">{processInline(line)}</p>);
    }

    flushList();

    return <>{elements}</>;
}
