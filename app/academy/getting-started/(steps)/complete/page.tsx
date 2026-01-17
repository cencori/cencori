import Link from "next/link";
import { ArrowRight, BookOpen, Shield, Code2, Trophy, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CompletePage() {
    return (
        <div className="max-w-2xl mx-auto text-center">
            {/* Celebration */}
            <div className="mb-12">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
                    <Trophy className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-4">
                    Course Complete! 🎉
                </h1>
                <p className="text-lg text-muted-foreground">
                    You&apos;ve mastered the fundamentals of Cencori. You&apos;re now ready to build production AI applications with confidence.
                </p>
            </div>

            {/* What You Learned */}
            <div className="mb-12 text-left">
                <h2 className="text-lg font-semibold mb-4 text-center">What You Achieved</h2>
                <div className="grid gap-3">
                    {[
                        "Created a Cencori account and project",
                        "Connected AI provider keys (BYOK)",
                        "Generated Cencori API keys",
                        "Installed and configured the SDK",
                        "Made AI chat requests",
                        "Enabled real-time streaming",
                        "Explored request logs and analytics",
                        "Learned about built-in security features",
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                ✓
                            </span>
                            <span className="text-sm">{item}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Next Steps */}
            <div className="mb-12">
                <h2 className="text-lg font-semibold mb-4">What&apos;s Next?</h2>
                <div className="grid gap-4 sm:grid-cols-2 text-left">
                    <Link href="/docs">
                        <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader className="pb-2">
                                <BookOpen className="h-5 w-5 text-primary mb-2" />
                                <CardTitle className="text-base">Documentation</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                Dive deeper into all features and API reference
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/docs/security/pii-detection">
                        <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader className="pb-2">
                                <Shield className="h-5 w-5 text-primary mb-2" />
                                <CardTitle className="text-base">Security Deep Dive</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                Learn about custom rules and advanced security
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/docs/concepts/streaming">
                        <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader className="pb-2">
                                <Code2 className="h-5 w-5 text-primary mb-2" />
                                <CardTitle className="text-base">SDK Reference</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                Explore all SDK methods and options
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/dashboard">
                        <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader className="pb-2">
                                <ArrowRight className="h-5 w-5 text-primary mb-2" />
                                <CardTitle className="text-base">Start Building</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                Head to your dashboard and build something!
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>

            {/* Share */}
            <div className="py-8 border-t border-border/40">
                <p className="text-sm text-muted-foreground mb-4">
                    Share your achievement
                </p>
                <div className="flex justify-center gap-3">
                    <a
                        href="https://twitter.com/intent/tweet?text=Just%20completed%20the%20Cencori%20Getting%20Started%20course!%20Now%20I%20can%20build%20production%20AI%20apps%20with%20built-in%20security.%20%F0%9F%9A%80&url=https://cencori.com/academy"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="outline" size="sm" className="gap-2">
                            <Twitter className="h-4 w-4" />
                            Tweet
                        </Button>
                    </a>
                    <a
                        href="https://www.linkedin.com/sharing/share-offsite/?url=https://cencori.com/academy"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="outline" size="sm" className="gap-2">
                            <Linkedin className="h-4 w-4" />
                            Share
                        </Button>
                    </a>
                </div>
            </div>

            {/* Back to Academy */}
            <div className="pt-8">
                <Link href="/academy">
                    <Button variant="ghost" className="gap-2">
                        <ArrowRight className="h-4 w-4 rotate-180" />
                        Back to Academy
                    </Button>
                </Link>
            </div>
        </div>
    );
}
