import { NextRequest, NextResponse } from "next/server";
import { getFile, isFileBucket } from "@/lib/storage/files";

// Files copied from Supabase Storage were stored without a type; the
// extension is a safe fallback since uploads only accept these images.
const TYPES_BY_EXTENSION: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
};

function contentType(stored: string | null, key: string): string {
    if (stored && stored !== "application/octet-stream") return stored;
    return TYPES_BY_EXTENSION[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

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
            "content-type": contentType(file.headers.get("content-type"), key.join("/")),
            ...(file.headers.get("content-length") ? { "content-length": file.headers.get("content-length")! } : {}),
            // New uploads get a new key or a ?t= cache-buster, so a day of caching is safe.
            "cache-control": "public, max-age=86400",
            "x-content-type-options": "nosniff",
        },
    });
}
