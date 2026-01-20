import Link from "next/link";
import { ArrowRight, Clock, BookOpen, Zap, Shield, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const courses = [
    {
        id: "getting-started",
        title: "Getting Started with Cencori",
        description: "Learn the fundamentals: set up your account, make your first AI request, and explore the dashboard.",
        duration: "15 min",
        steps: 9,
        difficulty: "Beginner",
        icon: Zap,
        featured: true,
        href: "/academy/getting-started",
    },
    {
        id: "security-deep-dive",
        title: "Security Deep Dive",
        description: "Master Cencori's security features: PII detection, jailbreak protection, and custom rules.",
        duration: "20 min",
        steps: 6,
        difficulty: "Intermediate",
        icon: Shield,
        featured: false,
        href: "/academy/security-deep-dive",
        comingSoon: true,
    },
    {
        id: "sdk-mastery",
        title: "SDK Mastery",
        description: "Advanced SDK usage: streaming, error handling, Vercel AI SDK integration, and best practices.",
        duration: "25 min",
        steps: 8,
        difficulty: "Intermediate",
        icon: Code2,
        featured: false,
        href: "/academy/sdk-mastery",
        comingSoon: true,
    },
];

export default function AcademyPage() {
    return (
        <div className="max-w-4xl mx-auto mt-32">
            <div className="text-center mb-12">
                <Badge variant="secondary" className="mb-4">
                    Interactive Learning
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight mb-4">
                    Cencori Academy
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Learn to build production AI applications through hands-on tutorials.
                    Each course guides you step-by-step with real code examples.
                </p>
            </div>

            <div className="mb-12">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Start Here
                </h2>
                {courses.filter(c => c.featured).map(course => (
                    <Link key={course.id} href={course.href}>
                        <Card className="group hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <course.icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="group-hover:text-primary transition-colors">
                                                {course.title}
                                            </CardTitle>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {course.duration}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <BookOpen className="h-3.5 w-3.5" />
                                                    {course.steps} steps
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {course.difficulty}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    {course.description}
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    More Courses
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    {courses.filter(c => !c.featured).map(course => (
                        <Card
                            key={course.id}
                            className={course.comingSoon ? "opacity-60" : "hover:border-primary/50 transition-colors cursor-pointer"}
                        >
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                        <course.icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            {course.title}
                                            {course.comingSoon && (
                                                <Badge variant="secondary" className="text-xs">
                                                    Coming Soon
                                                </Badge>
                                            )}
                                        </CardTitle>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-sm text-muted-foreground mb-3">
                                    {course.description}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {course.duration}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <BookOpen className="h-3 w-3" />
                                        {course.steps} steps
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <div className="mt-16 text-center py-12 border-t border-border/40">
                <h2 className="text-xl font-semibold mb-2">Ready to get started?</h2>
                <p className="text-muted-foreground mb-6">
                    Jump into our beginner course and ship your first AI feature in 15 minutes.
                </p>
                <Link href="/academy/getting-started">
                    <Button size="lg" className="gap-2">
                        Start Learning
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
