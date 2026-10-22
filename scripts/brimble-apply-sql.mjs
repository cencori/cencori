// Applies the idempotent SQL files in database/brimble/ to the Brimble
// Postgres, in name order, one transaction per file. Runs as brimble.toml's
// before_start, inside Brimble's private network (the database is not
// public). Skips cleanly when BETTER_AUTH_DATABASE_URL isn't set, so a
// deploy without the database still starts.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.BETTER_AUTH_DATABASE_URL;
if (!url) {
    console.log("[brimble-apply-sql] BETTER_AUTH_DATABASE_URL not set; skipping");
    process.exit(0);
}

const dir = path.join(process.cwd(), "database", "brimble");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
    for (const file of files) {
        const sql = await readFile(path.join(dir, file), "utf8");
        await client.query("begin");
        try {
            await client.query(sql);
            await client.query("commit");
            console.log(`[brimble-apply-sql] applied ${file}`);
        } catch (error) {
            await client.query("rollback");
            throw new Error(`${file}: ${error.message}`);
        }
    }
} finally {
    await client.end();
}
