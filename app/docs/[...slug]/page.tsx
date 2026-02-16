import { notFound } from "next/navigation";
import { getDocBySlug, getAllDocs, parseMDX, getDocNavigation } from "@/lib/docs";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocPageProps {
    params: Promise<{
        slug: string[];
    }>;
}

// Generate static params for all docs
export async function generateStaticParams() {
    const docs = getAllDocs();
    return docs.map((doc) => ({
        slug: doc.slug.split('/'),
    }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
    const { slug } = await params;
    const slugPath = slug.join('/');
    const doc = getDocBySlug(slugPath);

    if (!doc) {
        return {
            title: "Not Found",
        };
    }

    return {
        title: doc.title,
        description: doc.description,
        openGraph: {
            title: `${doc.title} | Cencori Docs`,
            description: doc.description,
            type: "article",
            images: [
                {
                    url: `/api/og?title=${encodeURIComponent(doc.title)}&subtitle=${encodeURIComponent(doc.section)}&type=docs`,
                    width: 1200,
                    height: 630,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: `${doc.title} | Cencori Docs`,
            description: doc.description,
            images: [`/api/og?title=${encodeURIComponent(doc.title)}&subtitle=${encodeURIComponent(doc.section)}&type=docs`],
        },
    };
}

export default async function DocPage({ params }: DocPageProps) {
    const { slug } = await params;
    const slugPath = slug.join('/');
    const doc = getDocBySlug(slugPath);

    if (!doc) {
        notFound();
    }

    const content = await parseMDX(doc.content);
    const { prev, next } = getDocNavigation(slugPath);

    const lastUpdated = doc.lastUpdated
        ? new Date(doc.lastUpdated).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : null;

    return (
        <article className="px-4 py-10 lg:py-0 w-full">
            <div className="space-y-3 mb-8">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{doc.section}</p>
                <h1 className="text-4xl font-bold tracking-tight border-b border-border/40 pb-3">{doc.title}</h1>
                {lastUpdated && (
                    <p className="text-xs text-muted-foreground">Last updated {lastUpdated}</p>
                )}
                {doc.description && (
                    <p className="text-base text-muted-foreground">{doc.description}</p>
                )}
            </div>

            <div className="prose prose-zinc dark:prose-invert max-w-none">
                {content}
            </div>

            {/* Navigation */}
            {(prev || next) && (
                <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                    {prev ? (
                        <Link href={`/docs/${prev.slug}`}>
                            <Button variant="ghost" className="gap-2">
                                <ChevronLeft className="h-4 w-4" />
                                <span className="flex flex-col items-start">
                                    <span className="text-xs text-muted-foreground">Previous</span>
                                    <span className="text-sm font-medium">{prev.title}</span>
                                </span>
                            </Button>
                        </Link>
                    ) : <div />}
                    {next && (
                        <Link href={`/docs/${next.slug}`}>
                            <Button variant="ghost" className="gap-2">
                                <span className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">Next</span>
                                    <span className="text-sm font-medium">{next.title}</span>
                                </span>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    )}
                </div>
            )}
        </article>
    );
}
