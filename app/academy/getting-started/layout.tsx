"use client";

import { usePathname } from "next/navigation";
import { CourseLayout } from "@/components/academy";
import { GETTING_STARTED_STEPS, COURSE_ID, COURSE_TITLE } from "./steps";

function IntroHero() {
    return (
        <div className="text-center py-16 md:py-24 border-b border-border/40 mb-0">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
                {COURSE_TITLE}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Build your first AI-powered application using Cencori&apos;s unified
                infrastructure. From zero to production in 15 minutes.
            </p>
        </div>
    );
}

export default function GettingStartedLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isIntro = pathname === "/academy/getting-started";

    return (
        <CourseLayout
            courseId={COURSE_ID}
            courseTitle={COURSE_TITLE}
            steps={GETTING_STARTED_STEPS}
            hero={isIntro ? <IntroHero /> : undefined}
        >
            {children}
        </CourseLayout>
    );
}
