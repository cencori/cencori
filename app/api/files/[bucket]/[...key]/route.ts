import { NextRequest, NextResponse } from "next/server";
import { getFile, isFileBucket } from "@/lib/storage/files";

// Serves uploaded files (avatars, email images) from the private Lagos bucket.
// These were public in Supabase Storage and are linked from emails, so they
// stay readable without a session.
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ bucket: string; key: string[] }> },
) {
    const { bucket, key } = await params;
    if (!isFileBucket(bucket) || key.length === 0 || key.some((part) => part === ".." || part === "." || part === "")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const file = await getFile(bucket, key.join("/")).catch(() => null);
    if (!file?.body) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(file.body, {
        headers: {
            "content-type": file.headers.get("content-type") || "application/octet-stream",
            ...(file.headers.get("content-length") ? { "content-length": file.headers.get("content-length")! } : {}),
            // New uploads get a new key or a ?t= cache-buster, so a day of caching is safe.
            "cache-control": "public, max-age=86400",
            "x-content-type-options": "nosniff",
        },
    });
}
