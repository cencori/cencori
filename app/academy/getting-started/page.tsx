import Link from "next/link";
import { ArrowRight, Clock, BookOpen, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GETTING_STARTED_STEPS } from "./steps";

export default function GettingStartedPage() {
    const totalDuration = GETTING_STARTED_STEPS.reduce((acc, step) => {
        const mins = parseInt(step.duration);
        return acc + mins;
    }, 0);

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-10">
                <Badge variant="secondary" className="mb-4">
                    Beginner Course
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight mb-4">
                    Getting Started with Cencori
                </h1>
                <p className="text-lg text-muted-foreground mb-6">
                    Learn the fundamentals of Cencori in this hands-on tutorial.
                    You&apos;ll set up your account, make your first AI request, and explore the dashboard.
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {totalDuration} minutes
                    </span>
                    <span className="flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        {GETTING_STARTED_STEPS.length} steps
                    </span>
                </div>
            </div>

            {/* What You'll Learn */}
            <div className="mb-10">
                <h2 className="text-xl font-semibold mb-4">What You&apos;ll Learn</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {[
                        "Set up your Cencori account and project",
                        "Connect AI provider keys (OpenAI, Anthropic, Gemini)",
                        "Make AI chat requests through Cencori",
                        "Enable real-time streaming responses",
                        "View request logs and analytics",
                        "Understand built-in security features",
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <span className="text-sm">{item}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Prerequisites */}
            <div className="mb-10">
                <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Node.js 18+ or Python 3.8+ installed</li>
                    <li>• An API key from OpenAI, Anthropic, or Google (Gemini)</li>
                    <li>• Basic familiarity with JavaScript/TypeScript or Python</li>
                </ul>
            </div>

            {/* Course Outline */}
            <div className="mb-10">
                <h2 className="text-xl font-semibold mb-4">Course Outline</h2>
                <div className="space-y-2">
                    {GETTING_STARTED_STEPS.map((step, index) => (
                        <Card key={step.id} className="hover:bg-muted/30 transition-colors">
                            <CardContent className="flex items-center gap-4 py-4">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium">{step.title}</p>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {step.description}
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {step.duration}
                                </span>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Start Button */}
            <div className="flex justify-center py-8">
                <Link href="/academy/getting-started/step-1">
                    <Button size="lg" className="gap-2">
                        Start Course
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
