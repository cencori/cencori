import { NextRequest, NextResponse } from "next/server";
import { getDocBySlug } from "@/lib/docs";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
        return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    try {
        const doc = getDocBySlug(slug);
        if (!doc) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        return NextResponse.json({ content: doc.content });
    } catch (error) {
        console.error("[Docs Raw] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
