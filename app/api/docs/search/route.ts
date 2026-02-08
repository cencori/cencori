import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

interface SearchResult {
    title: string;
    description: string;
    section: string;
    href: string;
    snippet: string;
    score: number;
}

interface DocFrontmatter {
    title: string;
    description: string;
    section: string;
    order?: number;
}

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

function getMdxFiles(dir: string, basePath = ""): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);

        if (entry.isDirectory()) {
            files.push(...getMdxFiles(fullPath, relativePath));
        } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
            files.push(relativePath);
        }
    }

    return files;
}

function filePathToSlug(filePath: string): string {
    return filePath
        .replace(/\.(mdx|md)$/, "")
        .replace(/\/_index$/, "")
        .replace(/\/index$/, "")
        .replace(/^\//, "");
}

function getSnippet(content: string, query: string, maxLength = 150): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Find the position of the query in the content
    const position = lowerContent.indexOf(lowerQuery);

    if (position === -1) {
        // Return first part of content if query not found
        return content.slice(0, maxLength).trim() + (content.length > maxLength ? "..." : "");
    }

    // Get surrounding context
    const start = Math.max(0, position - 50);
    const end = Math.min(content.length, position + query.length + 100);

    let snippet = content.slice(start, end).trim();

    // Add ellipsis if truncated
    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";

    return snippet;
}

function scoreMatch(doc: { title: string; description: string; content: string }, query: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = doc.title.toLowerCase();
    const lowerDescription = doc.description.toLowerCase();
    const lowerContent = doc.content.toLowerCase();

    let score = 0;

    // Title matches are highest priority
    if (lowerTitle === lowerQuery) {
        score += 100;
    } else if (lowerTitle.includes(lowerQuery)) {
        score += 50;
    } else if (lowerQuery.split(" ").some(word => lowerTitle.includes(word))) {
        score += 25;
    }

    // Description matches
    if (lowerDescription.includes(lowerQuery)) {
        score += 30;
    } else if (lowerQuery.split(" ").some(word => lowerDescription.includes(word))) {
        score += 15;
    }

    // Content matches
    const contentMatches = (lowerContent.match(new RegExp(lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g")) || []).length;
    score += Math.min(contentMatches * 2, 20);

    return score;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query || query.length < 2) {
        return NextResponse.json({ results: [] });
    }

    try {
        const files = getMdxFiles(DOCS_DIR);
        const results: SearchResult[] = [];

        for (const file of files) {
            const filePath = path.join(DOCS_DIR, file);
            const fileContents = fs.readFileSync(filePath, "utf-8");
            const { data, content } = matter(fileContents);

            const frontmatter = data as DocFrontmatter;
            const slug = filePathToSlug(file);

            // Calculate match score
            const score = scoreMatch(
                {
                    title: frontmatter.title || "",
                    description: frontmatter.description || "",
                    content
                },
                query
            );

            if (score > 0) {
                // Remove MDX/JSX tags and code blocks for cleaner snippets
                const cleanContent = content
                    .replace(/<[^>]+>/g, " ")
                    .replace(/```[\s\S]*?```/g, " ")
                    .replace(/`[^`]+`/g, " ")
                    .replace(/\{[^}]+\}/g, " ")
                    .replace(/#+\s/g, " ")
                    .replace(/\*\*([^*]+)\*\*/g, "$1")
                    .replace(/\*([^*]+)\*/g, "$1")
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                    .replace(/\n+/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                results.push({
                    title: frontmatter.title || slug,
                    description: frontmatter.description || "",
                    section: frontmatter.section || "Documentation",
                    href: `/docs/${slug}`,
                    snippet: getSnippet(cleanContent, query),
                    score,
                });
            }
        }

        // Sort by score and limit to 10 results
        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, 10);

        return NextResponse.json({ results: topResults });
    } catch (error) {
        console.error("Search error:", error);
        return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
    }
}
