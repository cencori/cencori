import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders; body: Buffer };
const seen: Seen[] = [];
let failNext = 0;
const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
        seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
        if (failNext > 0) {
            failNext -= 1;
            res.statusCode = 503;
            res.end("<Error><Code>SlowDown</Code></Error>");
            return;
        }
        res.end();
    });
});

beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    process.env.NEXT_PUBLIC_BETTER_AUTH_ENABLED = "true";
    process.env.FILES_S3_ENDPOINT = `http://127.0.0.1:${port}`;
    process.env.FILES_S3_BUCKET = "files";
    process.env.FILES_S3_ACCESS_KEY_ID = "AK";
    process.env.FILES_S3_SECRET_ACCESS_KEY = "SK";
    process.env.FILES_S3_REGION = "los";
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("putFile to Lagos", () => {
    it("sends the bytes with their length, signed, not chunked", async () => {
        const { putFile } = await import("@/lib/storage/files");
        // A view into a bigger buffer, as Buffer.from(base64) can be: only the view's bytes go.
        const pool = Buffer.alloc(10_000, 7);
        const bytes = Buffer.from(pool.buffer, 100, 5_000);
        expect(await putFile("event-banners", "proj/event/1.jpg", bytes, "image/jpeg")).toEqual({ error: null });
        const request = seen.at(-1)!;
        expect(request.method).toBe("PUT");
        expect(request.url).toBe("/files/event-banners/proj/event/1.jpg");
        expect(request.headers["content-length"]).toBe("5000");
        expect(request.headers["transfer-encoding"]).toBeUndefined();
        expect(request.headers["content-type"]).toBe("image/jpeg");
        expect(request.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/los\/s3\/aws4_request/);
        expect(request.headers["x-amz-content-sha256"]).toBe("UNSIGNED-PAYLOAD");
        expect(request.body.equals(bytes)).toBe(true);
    });

    it("tries once more when storage stumbles, and says what it said when it keeps failing", async () => {
        const { putFile } = await import("@/lib/storage/files");
        failNext = 1;
        expect(await putFile("avatars", "user/2.png", new Uint8Array([1, 2, 3]), "image/png")).toEqual({ error: null });
        failNext = 2;
        expect(await putFile("avatars", "user/3.png", new Uint8Array([1, 2, 3]), "image/png")).toEqual({ error: "Upload failed (503 SlowDown)" });
    });
});
