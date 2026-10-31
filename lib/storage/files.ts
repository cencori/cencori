import "server-only";

import http from "node:http";
import https from "node:https";
import { AwsClient, AwsV4Signer } from "aws4fetch";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { ensureStorageBucket } from "@/lib/storage-buckets";

// Uploaded files (avatars, email images, event banners). Supabase Storage until the RFC-0001
// cutover, then one private Brimble bucket in Lagos (FILES_S3_*), where each
// logical bucket below is a key prefix. Files are served by the app at
// /api/files/<bucket>/<key>, so stored URLs stay on our own domain whichever
// store is behind them.

export const FILE_BUCKETS = ["avatars", "email-images", "sender-avatars", "event-banners"] as const;
export type FileBucket = (typeof FILE_BUCKETS)[number];

export function isFileBucket(value: string): value is FileBucket {
    return (FILE_BUCKETS as readonly string[]).includes(value);
}

interface S3Config {
    client: AwsClient;
    bucketUrl: string;
    credentials: { accessKeyId: string; secretAccessKey: string; region: string };
}

let s3: S3Config | null = null;

function s3Config(): S3Config {
    if (s3) return s3;
    const endpoint = process.env.FILES_S3_ENDPOINT;
    const bucket = process.env.FILES_S3_BUCKET;
    const accessKeyId = process.env.FILES_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.FILES_S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
        throw new Error("FILES_S3_ENDPOINT, FILES_S3_BUCKET and FILES_S3_* keys must be set");
    }
    s3 = {
        client: new AwsClient({
            accessKeyId,
            secretAccessKey,
            service: "s3",
            region: process.env.FILES_S3_REGION || "los",
            // aws4fetch retries 5xx up to 10 times with backoff by default,
            // which holds an avatar request open for ~20 s while storage is down.
            retries: 1,
        }),
        // Path-style addressing, as Brimble requires.
        bucketUrl: `${endpoint.replace(/\/$/, "")}/${bucket}`,
        credentials: { accessKeyId, secretAccessKey, region: process.env.FILES_S3_REGION || "los" },
    };
    return s3;
}

function objectUrl(bucket: FileBucket, key: string): string {
    const path = `${bucket}/${key}`.split("/").map(encodeURIComponent).join("/");
    return `${s3Config().bucketUrl}/${path}`;
}

/** Public URL of a stored file: Supabase's until the cutover, then app/api/files. */
export function fileUrl(bucket: FileBucket, key: string): string {
    if (!isBetterAuthEnabled()) {
        return createAdminClient().storage.from(bucket).getPublicUrl(key).data.publicUrl;
    }
    const base = (process.env.FILES_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://cencori.com")
        .replace(/\/$/, "");
    return `${base}/api/files/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function putFile(
    bucket: FileBucket,
    key: string,
    body: Uint8Array,
    contentType: string,
    { upsert = true }: { upsert?: boolean } = {},
): Promise<{ error: string | null }> {
    if (!isBetterAuthEnabled()) {
        const { error } = await createAdminClient().storage
            .from(bucket)
            .upload(key, body, { contentType, upsert });
        return { error: error?.message ?? null };
    }
    // `upsert: false` isn't enforced here: Lagos rejects If-None-Match outright
    // (400, 2026-10-23), and every caller already writes a unique,
    // timestamped key.
    const response = await putObject(objectUrl(bucket, key), body, contentType);
    if (response.ok) return { error: null };
    // Log what storage said (its <Code>, e.g. AccessDenied): the routes answer a bare 502, and
    // without this a failing bucket left nothing to go on (event banners, 2026-10-30).
    const detail = response.body.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? "";
    console.error(`[files] PUT ${bucket}/${key} (${body.byteLength} bytes) failed: ${response.status} ${detail}`.trim());
    return { error: `Upload failed (${response.status}${detail ? ` ${detail}` : ""})` };
}

/**
 * One upload, signed by aws4fetch but sent by Node itself with its length.
 * Lagos refused every upload from the app with 422 NobusFosRequestFailed,
 * while the same signed request from a plain Node script stored fine at any
 * size and path (event banners, 2026-10-31). The difference is the app's
 * global fetch, which Next.js wraps: aws4fetch hands it a Request, whose body
 * is a stream, so its length can go missing. Sent here with an explicit
 * Content-Length instead. One retry on a 5xx or a dropped connection, as the
 * client does for the other calls.
 */
async function putObject(url: string, body: Uint8Array, contentType: string, attempt = 0): Promise<{ ok: boolean; status: number; body: string }> {
    const { credentials } = s3Config();
    const signed = await new AwsV4Signer({
        url, method: "PUT", body: body as Uint8Array<ArrayBuffer>, headers: { "content-type": contentType },
        accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey, service: "s3", region: credentials.region,
    }).sign();
    const headers: Record<string, string> = { "content-length": String(body.byteLength) };
    signed.headers.forEach((value, name) => { headers[name] = value; });
    const result = await new Promise<{ ok: boolean; status: number; body: string }>((resolve) => {
        const send = signed.url.protocol === "http:" ? http.request : https.request;
        const request = send(signed.url, { method: "PUT", headers, timeout: 30_000 }, (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () => {
                const status = response.statusCode ?? 0;
                resolve({ ok: status >= 200 && status < 300, status, body: Buffer.concat(chunks).toString("utf8").slice(0, 2_000) });
            });
        });
        request.on("timeout", () => request.destroy(new Error("timed out")));
        request.on("error", () => resolve({ ok: false, status: 0, body: "" }));
        request.end(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
    });
    if (!result.ok && (result.status === 0 || result.status >= 500) && attempt === 0) return putObject(url, body, contentType, 1);
    return result;
}

/** Keys of the files directly under `folder`, e.g. a user's id. */
export async function listFiles(bucket: FileBucket, folder: string): Promise<string[]> {
    if (!isBetterAuthEnabled()) {
        const { data } = await createAdminClient().storage.from(bucket).list(folder);
        return (data ?? []).map((item) => `${folder}/${item.name}`);
    }
    const prefix = `${bucket}/${folder}/`;
    const url = new URL(s3Config().bucketUrl);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    const response = await s3Config().client.fetch(url.toString());
    if (!response.ok) return [];
    const xml = await response.text();
    return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)]
        .map((match) => decodeXml(match[1]).slice(bucket.length + 1));
}

export async function removeFiles(bucket: FileBucket, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (!isBetterAuthEnabled()) {
        await createAdminClient().storage.from(bucket).remove(keys);
        return;
    }
    await Promise.all(
        keys.map((key) => s3Config().client.fetch(objectUrl(bucket, key), { method: "DELETE" })),
    );
}

/**
 * Creates or reconciles the Supabase bucket before an upload. Nothing to do in
 * Lagos: the one Brimble bucket exists, and type/size limits are checked by
 * the upload routes. Returns an error message or null.
 */
export async function ensureFileBucket(
    bucket: FileBucket,
    options: Parameters<typeof ensureStorageBucket>[2],
): Promise<string | null> {
    if (isBetterAuthEnabled()) return null;
    return ensureStorageBucket(createAdminClient(), bucket, options);
}

/** The stored object, for app/api/files. null when it doesn't exist. */
export async function getFile(bucket: FileBucket, key: string): Promise<Response | null> {
    const response = await s3Config().client.fetch(objectUrl(bucket, key));
    if (response.ok) return response;
    // A missing file is a 404 here too, so say when it was storage failing instead.
    if (response.status !== 404) console.error(`[files] GET ${bucket}/${key} failed: ${response.status}`);
    return null;
}

function decodeXml(value: string): string {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}
