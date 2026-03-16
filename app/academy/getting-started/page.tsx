import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCourseIntro, parseAcademyMDX } from "@/lib/academy";
import { GETTING_STARTED_STEPS, COURSE_TITLE } from "./steps";

export default async function GettingStartedPage() {
    const intro = getCourseIntro("getting-started");
    const mdxContent = intro ? await parseAcademyMDX(intro.content) : null;

    return (
        <>
            {mdxContent && (
                <div className="prose prose-neutral dark:prose-invert max-w-none">
                    {mdxContent}
                </div>
            )}

            {/* Start CTA */}
            <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden mt-12 not-prose">
                <div className="px-6 py-4 border-b border-border/40">
                    <p className="font-semibold">Start Your Learning Journey</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Begin with the first lesson to start this course.
                    </p>
                </div>
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            1
                        </div>
                        <div>
                            <p className="text-sm font-medium">{GETTING_STARTED_STEPS[0].title}</p>
                            <p className="text-xs text-muted-foreground">
                                0 of {GETTING_STARTED_STEPS.length} lessons completed (0%)
                            </p>
                        </div>
                    </div>
                    <Link href={GETTING_STARTED_STEPS[0].href}>
                        <Button size="sm" className="gap-2">
                            Begin Course
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                </div>
            </div>
        </>
    );
}
