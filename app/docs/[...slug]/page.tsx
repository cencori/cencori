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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cencori.com";

    return {
        title: doc.title,
        description: doc.description,
        openGraph: {
            title: `${doc.title} | Cencori Docs`,
            description: doc.description,
            type: "article",
            images: [
                {
                    url: `${baseUrl}/api/og?title=${encodeURIComponent(doc.title)}&subtitle=${encodeURIComponent(doc.section)}&type=docs`,
                    width: 1200,
                    height: 630,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: `${doc.title} | Cencori Docs`,
            description: doc.description,
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

    return (
        <div className="max-w-4xl">
            {/* Main Content */}
            <article className="px-4 py-12 lg:py-0">
                <div className="space-y-2 mb-8">
                    <p className="text-sm text-muted-foreground">{doc.section}</p>
                    <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
                    {doc.description && (
                        <p className="text-muted-foreground">{doc.description}</p>
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
        </div>
    );
}

