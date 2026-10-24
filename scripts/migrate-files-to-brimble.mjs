// Copies uploaded files from Supabase Storage into the Lagos bucket and
// points the stored URLs at /api/files (RFC-0001 cutover, lib/storage/files.ts).
//
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   source; files are only read
//   FILES_S3_ENDPOINT, FILES_S3_BUCKET, FILES_S3_ACCESS_KEY_ID,
//   FILES_S3_SECRET_ACCESS_KEY, FILES_S3_REGION   the Brimble bucket
//   FILES_PUBLIC_BASE_URL                     e.g. https://cencori.com
//   TARGET_DATABASE_URL                       Brimble Postgres, for the URL rewrite
//
//   node scripts/migrate-files-to-brimble.mjs           dry run: list what would be copied
//   node scripts/migrate-files-to-brimble.mjs --apply   copy, then rewrite URLs in TARGET
//   … --apply --files-only                              copy only (TARGET_DATABASE_URL not needed)
//
// Each Supabase bucket becomes a key prefix: avatars/<key>, email-images/<key>…
// Re-runnable: objects are overwritten in place and the URL rewrite only
// touches rows that still point at Supabase. Emails already sent keep their
// Supabase image links; those break only when the Supabase project is deleted.
import { AwsClient } from "aws4fetch";
import pg from "pg";

const apply = process.argv.includes("--apply");
const filesOnly = process.argv.includes("--files-only");
const BUCKETS = ["avatars", "email-images", "sender-avatars", "scan-exports"];
// Columns that hold a Supabase public URL to rewrite.
const URL_COLUMNS = [
    ["user_profiles", "avatar_url"],
    ["email_sender_profiles", "avatar_url"],
];

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const s3 = new AwsClient({
    accessKeyId: required("FILES_S3_ACCESS_KEY_ID"),
    secretAccessKey: required("FILES_S3_SECRET_ACCESS_KEY"),
    service: "s3",
    region: process.env.FILES_S3_REGION || "los",
});
const bucketUrl = `${required("FILES_S3_ENDPOINT").replace(/\/$/, "")}/${required("FILES_S3_BUCKET")}`;
const publicBase = required("FILES_PUBLIC_BASE_URL").replace(/\/$/, "");

const storageHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

// Supabase serves these downloads as application/octet-stream; keep the real image type.
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", json: "application/json", csv: "text/csv" };
function typeFor(key, served) {
    if (served && served !== "application/octet-stream") return served;
    return TYPES[key.split(".").pop().toLowerCase()] ?? "application/octet-stream";
}

// Supabase's list API returns one folder level; folders have no id.
async function listObjects(bucket, prefix = "") {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: { ...storageHeaders, "content-type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    });
    if (!response.ok) throw new Error(`list ${bucket}/${prefix}: ${response.status} ${await response.text()}`);
    const keys = [];
    for (const item of await response.json()) {
        const key = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) keys.push(key);
        else keys.push(...(await listObjects(bucket, key)));
    }
    return keys;
}

async function copy(bucket, key) {
    const source = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${encodePath(key)}`, {
        headers: storageHeaders,
    });
    if (!source.ok) throw new Error(`download ${bucket}/${key}: ${source.status}`);
    const body = new Uint8Array(await source.arrayBuffer());
    const target = await s3.fetch(`${bucketUrl}/${encodePath(`${bucket}/${key}`)}`, {
        method: "PUT",
        body,
        headers: { "content-type": typeFor(key, source.headers.get("content-type")) },
    });
    if (!target.ok) throw new Error(`upload ${bucket}/${key}: ${target.status} ${await target.text()}`);
    return body.length;
}

// libpq's sslmode=require: encrypt, don't verify (see migrate-users-to-better-auth.mjs).
function clientConfig(url) {
    const parsed = new URL(url);
    if (parsed.searchParams.get("sslmode") !== "require") return { connectionString: url };
    parsed.searchParams.delete("sslmode");
    return { connectionString: parsed.toString(), ssl: { rejectUnauthorized: false } };
}

async function rewriteUrls() {
    const client = new pg.Client(clientConfig(required("TARGET_DATABASE_URL")));
    await client.connect();
    const from = `${supabaseUrl}/storage/v1/object/public/`;
    const to = `${publicBase}/api/files/`;
    try {
        for (const [table, column] of URL_COLUMNS) {
            const { rowCount } = await client.query(
                `update public.${table} set ${column} = replace(${column}, $1, $2) where ${column} like $3`,
                [from, to, `${from}%`],
            );
            console.log(`rewrote ${rowCount} ${table}.${column}`);
        }
    } finally {
        await client.end();
    }
}

let files = 0;
let bytes = 0;
for (const bucket of BUCKETS) {
    const keys = await listObjects(bucket);
    console.log(`${bucket}: ${keys.length} files`);
    for (const key of keys) {
        if (apply) bytes += await copy(bucket, key);
        files += 1;
    }
}
console.log(apply ? `copied ${files} files (${bytes} bytes)` : `dry run: ${files} files would be copied`);
if (apply && !filesOnly) await rewriteUrls();
