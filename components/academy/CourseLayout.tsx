"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Circle, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface CourseStep {
    id: string;
    title: string;
    description: string;
    href: string;
    duration: string; // e.g., "2 min"
}

interface CourseLayoutProps {
    children: ReactNode;
    courseId: string;
    courseTitle: string;
    steps: CourseStep[];
}

function getStorageKey(courseId: string) {
    return `cencori-academy-${courseId}`;
}

function getCompletedSteps(courseId: string): string[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(getStorageKey(courseId));
    return stored ? JSON.parse(stored) : [];
}

function saveCompletedSteps(courseId: string, steps: string[]) {
    localStorage.setItem(getStorageKey(courseId), JSON.stringify(steps));
}

export function CourseLayout({ children, courseId, courseTitle, steps }: CourseLayoutProps) {
    const pathname = usePathname();
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);

    // Find current step
    const currentStepIndex = steps.findIndex(step => pathname.includes(step.href));
    const currentStep = steps[currentStepIndex];
    const prevStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;
    const nextStep = currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1] : null;

    // Calculate progress
    const progress = mounted ? Math.round((completedSteps.length / steps.length) * 100) : 0;

    useEffect(() => {
        setMounted(true);
        setCompletedSteps(getCompletedSteps(courseId));
    }, [courseId]);

    const markComplete = () => {
        if (currentStep && !completedSteps.includes(currentStep.id)) {
            const newCompleted = [...completedSteps, currentStep.id];
            setCompletedSteps(newCompleted);
            saveCompletedSteps(courseId, newCompleted);
        }
    };

    const isCompleted = (stepId: string) => completedSteps.includes(stepId);
    const isCurrent = (stepHref: string) => pathname.includes(stepHref);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Progress Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-lg font-semibold">{courseTitle}</h1>
                    <span className="text-sm text-muted-foreground">
                        {completedSteps.length}/{steps.length} complete
                    </span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            <div className="grid lg:grid-cols-[280px_1fr] gap-8">
                {/* Sidebar - Steps */}
                <aside className="hidden lg:block">
                    <nav className="space-y-1 sticky top-20">
                        {steps.map((step, index) => (
                            <Link
                                key={step.id}
                                href={step.href}
                                className={cn(
                                    "flex items-start gap-3 p-3 rounded-lg text-sm transition-colors",
                                    isCurrent(step.href)
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-muted/50"
                                )}
                            >
                                <div className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                                    isCompleted(step.id)
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : isCurrent(step.href)
                                            ? "border-primary text-primary"
                                            : "border-muted-foreground/30"
                                )}>
                                    {isCompleted(step.id) ? (
                                        <Check className="h-3 w-3" />
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "font-medium truncate",
                                        !isCurrent(step.href) && !isCompleted(step.id) && "text-muted-foreground"
                                    )}>
                                        {step.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <Clock className="h-3 w-3" />
                                        {step.duration}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <div className="min-w-0">
                    {/* Mobile step indicator */}
                    <div className="lg:hidden mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>Step {currentStepIndex + 1} of {steps.length}</span>
                    </div>

                    {/* Content */}
                    <div className="prose prose-neutral dark:prose-invert max-w-none">
                        {children}
                    </div>

                    {/* Navigation Footer */}
                    <div className="mt-12 pt-6 border-t border-border/40">
                        <div className="flex items-center justify-between gap-4">
                            {prevStep ? (
                                <Link href={prevStep.href}>
                                    <Button variant="ghost" className="gap-2">
                                        <ChevronLeft className="h-4 w-4" />
                                        <span className="hidden sm:inline">{prevStep.title}</span>
                                        <span className="sm:hidden">Previous</span>
                                    </Button>
                                </Link>
                            ) : (
                                <div />
                            )}

                            <div className="flex items-center gap-2">
                                {currentStep && !isCompleted(currentStep.id) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={markComplete}
                                        className="gap-2"
                                    >
                                        <Check className="h-4 w-4" />
                                        Mark Complete
                                    </Button>
                                )}
                                {nextStep ? (
                                    <Link href={nextStep.href}>
                                        <Button className="gap-2" onClick={markComplete}>
                                            Next: {nextStep.title}
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                ) : (
                                    <Link href={`/academy/${courseId}/complete`}>
                                        <Button className="gap-2" onClick={markComplete}>
                                            Complete Course
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
