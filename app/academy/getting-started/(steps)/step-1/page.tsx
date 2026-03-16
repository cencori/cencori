import { getLesson, parseAcademyMDX } from "@/lib/academy";
import { notFound } from "next/navigation";

export default async function Step1Page() {
    const lesson = getLesson("getting-started", "01-create-account");
    if (!lesson) return notFound();

    const content = await parseAcademyMDX(lesson.content);

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{lesson.title}</h1>
            <p className="text-muted-foreground mb-8">{lesson.description}</p>
            {content}
        </div>
    );
}
