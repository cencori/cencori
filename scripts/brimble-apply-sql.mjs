// Applies the idempotent SQL files in database/brimble/ to the Brimble
// Postgres, in name order, one transaction per file, each only when it is new
// or its contents changed (brimble_ops.sql_applied), or marked
// `-- brimble:every-deploy`. Runs as brimble.toml's
// before_start, inside Brimble's private network (the database is not
// public). Skips cleanly when BETTER_AUTH_DATABASE_URL isn't set, so a
// deploy without the database still starts.
import { createHash } from "node:crypto";
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

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

try {
    // Each file runs once, and again only when its contents change. This
    // runs while the previous deployment is still serving: re-running every
    // file on every deploy took table locks each time, and live queries
    // queued behind them (requests hung 15s+ during the 2026-11-09 deploys).
    // Its own schema: PostgREST serves only `public`, and new public tables
    // are granted to anon/authenticated by default.
    await client.query(`
        create schema if not exists brimble_ops;
        revoke all on schema brimble_ops from public;
        create table if not exists brimble_ops.sql_applied (
            file text primary key,
            sha256 text not null,
            applied_at timestamptz not null default now()
        );
    `);
    const { rows: appliedRows } = await client.query("select file, sha256 from brimble_ops.sql_applied");
    const applied = new Map(appliedRows.map((row) => [row.file, row.sha256]));

    // A file marked `-- brimble:every-deploy` runs every time, after all the
    // others: the lock-down guards (0100, 0300), written to take no table lock
    // when nothing needs fixing, so they also cover what this deploy added.
    const sources = await Promise.all(files.map(async (file) => {
        const sql = await readFile(path.join(dir, file), "utf8");
        return { file, sql, hash: sha256(sql), everyDeploy: /^--\s*brimble:every-deploy\b/m.test(sql) };
    }));
    const queue = [
        ...sources.filter((f) => !f.everyDeploy && applied.get(f.file) !== f.hash),
        ...sources.filter((f) => f.everyDeploy),
    ];

    let ran = 0;
    for (const { file, sql, hash, everyDeploy } of queue) {
        await client.query("begin");
        try {
            // A DDL statement waiting for a lock queues every later query on
            // that table behind it, so a stuck file must fail the deploy in
            // seconds, not hold production for Brimble's 25-minute timeout.
            await client.query("set local lock_timeout = '10s'");
            await client.query(sql);
            await client.query(
                `insert into brimble_ops.sql_applied (file, sha256) values ($1, $2)
                 on conflict (file) do update set sha256 = excluded.sha256, applied_at = now()`,
                [file, hash],
            );
            await client.query("commit");
            if (!everyDeploy || applied.get(file) !== hash) ran += 1;
            console.log(`[brimble-apply-sql] applied ${file}`);
        } catch (error) {
            await client.query("rollback");
            throw new Error(`${file}: ${error.message}`);
        }
    }
    console.log(`[brimble-apply-sql] ${ran} of ${files.length} file(s) new or changed; guards re-checked`);

    // PostgREST logs in as `authenticator` (0003_postgrest_roles.sql); its
    // password comes from the environment so it never sits in a SQL file.
    const authenticatorPassword = process.env.POSTGREST_AUTHENTICATOR_PASSWORD;
    if (authenticatorPassword) {
        await client.query(`alter role authenticator with login password ${client.escapeLiteral(authenticatorPassword)}`);
        console.log("[brimble-apply-sql] set authenticator password");
    }

    // PostgREST caches the schema and only sees functions and tables added
    // here after a reload (it isn't Supabase, so no event trigger does it).
    // Without this, a new function answers PGRST202 "not found" until
    // PostgREST happens to restart. It listens on the "pgrst" channel.
    // Only when something changed: a reload is a pause for every query.
    if (ran > 0) {
        await client.query("notify pgrst, 'reload schema'");
        console.log("[brimble-apply-sql] asked PostgREST to reload its schema");
    }

    // Long-open transactions hold locks that stall DDL and the queries queued
    // behind it (2026-11-01). The database is private, so report them here,
    // where the deploy log can show them. No query text: it can hold data.
    const { rows: longTransactions } = await client.query(`
        select a.pid, a.usename, a.application_name, a.client_addr::text as client_addr, a.state,
               a.wait_event_type, round(extract(epoch from now() - a.xact_start)) as xact_seconds,
               round(extract(epoch from now() - a.state_change)) as state_seconds,
               (select string_agg(distinct c.relname || ':' || l.mode, ', ')
                  from pg_locks l join pg_class c on c.oid = l.relation
                 where l.pid = a.pid and l.granted and c.relkind = 'r') as table_locks
        from pg_stat_activity a
        where a.xact_start < now() - interval '2 minutes' and a.pid <> pg_backend_pid()
        order by a.xact_start
    `);
    console.log(`[brimble-apply-sql] transactions open > 2 min: ${longTransactions.length}`);
    for (const row of longTransactions) console.log(`[brimble-apply-sql] long transaction ${JSON.stringify(row)}`);
} finally {
    await client.end();
}
