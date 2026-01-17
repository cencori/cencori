"use client";

import { CourseLayout } from "@/components/academy";
import { GETTING_STARTED_STEPS, COURSE_ID, COURSE_TITLE } from "../steps";

export default function StepLayout({ children }: { children: React.ReactNode }) {
    return (
        <CourseLayout
            courseId={COURSE_ID}
            courseTitle={COURSE_TITLE}
            steps={GETTING_STARTED_STEPS}
        >
            {children}
        </CourseLayout>
    );
}
